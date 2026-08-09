import { PaymentKind, PaymentMethod, TransactionStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';
import { getGateway } from '../payments/payments.service';
import { notify, notifyBoth } from '../notifications/notifications.service';

const money = (cents: number, currency: string) =>
  `${currency} ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// States in which funds are held in escrow and the buyer may confirm receipt or dispute.
const HELD_STATES: TransactionStatus[] = [
  TransactionStatus.HELD,
  TransactionStatus.SHIPPED,
  TransactionStatus.DELIVERED,
];

async function logEvent(
  transactionId: string,
  fromStatus: TransactionStatus | null,
  toStatus: TransactionStatus,
  note?: string
) {
  await prisma.transactionEvent.create({
    data: { transactionId, fromStatus, toStatus, note },
  });
}

/** Records a payment-ledger entry (deposit/release/refund) for admin/payment tracking. */
async function recordPayment(tx: { id: string; method: PaymentMethod; amountCents: number; gatewayRef: string | null }, kind: PaymentKind) {
  await prisma.payment.create({
    data: { transactionId: tx.id, method: tx.method, kind, amountCents: tx.amountCents, gatewayRef: tx.gatewayRef, status: 'SUCCESS' },
  });
}

export async function createEscrow(params: {
  buyerId: string;
  sellerEmail: string;
  description: string;
  amountCents: number;
  method: PaymentMethod;
}) {
  const seller = await prisma.user.findUnique({ where: { email: params.sellerEmail } });
  if (!seller) throw new HttpError(404, 'No account found for that seller email');
  if (seller.id === params.buyerId) throw new HttpError(400, "You can't open an escrow with yourself");

  const transaction = await prisma.transaction.create({
    data: {
      buyerId: params.buyerId,
      sellerId: seller.id,
      description: params.description,
      amountCents: params.amountCents,
      method: params.method,
      status: TransactionStatus.CREATED,
    },
  });
  await logEvent(transaction.id, null, TransactionStatus.CREATED, 'Escrow created');

  // Move to PAYMENT_PENDING the moment we hand off to the gateway, so the timeline
  // records the "awaiting payment" step even if capture is instant (simulated) or
  // asynchronous (a real M-Pesa STK push the buyer must approve on their phone).
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: TransactionStatus.PAYMENT_PENDING },
  });
  await logEvent(transaction.id, TransactionStatus.CREATED, TransactionStatus.PAYMENT_PENDING, 'Awaiting payment confirmation');

  // Kick off the deposit immediately; in the PayPal/Visa flows this returns a
  // reference the frontend then uses to complete buyer approval/3DS.
  const gateway = getGateway(params.method);
  const deposit = await gateway.deposit({
    amountCents: params.amountCents,
    currency: 'KES',
    reference: transaction.id,
  });
  const amount = money(params.amountCents, transaction.currency);

  // Asynchronous capture (e.g. M-Pesa STK push): the money is not captured yet.
  // Stay in PAYMENT_PENDING and store the gateway reference; our webhook flips it
  // to HELD once the buyer approves the prompt on their phone.
  if (deposit.pending) {
    const awaiting = await prisma.transaction.update({
      where: { id: transaction.id },
      data: { gatewayRef: deposit.gatewayRef },
    });
    await notify(params.buyerId, `Check your phone — approve the ${amount} M-Pesa prompt to fund "${params.description}".`, transaction.id);
    await notify(seller.id, `A ${amount} escrow for "${params.description}" is awaiting the buyer's payment.`, transaction.id);
    return awaiting;
  }

  // Synchronous capture (simulated / PayPal / Visa): funds are locked now.
  const held = await prisma.transaction.update({
    where: { id: transaction.id },
    data: { status: TransactionStatus.HELD, gatewayRef: deposit.gatewayRef },
  });
  await logEvent(transaction.id, TransactionStatus.PAYMENT_PENDING, TransactionStatus.HELD, 'Funds captured and locked');
  await recordPayment(held, PaymentKind.DEPOSIT);

  await notify(seller.id, `You have a new escrow of ${amount} for "${params.description}". Funds are held until the buyer confirms delivery.`, transaction.id);
  await notify(params.buyerId, `Your payment of ${amount} is held safely in escrow for "${params.description}".`, transaction.id);

  return held;
}

/**
 * Confirms (or rejects) an asynchronous deposit once the gateway calls back —
 * e.g. Safaricom's M-Pesa STK callback after the buyer approves the prompt.
 * Idempotent: only acts on a transaction still in PAYMENT_PENDING, so duplicate
 * webhook deliveries are safely ignored.
 */
export async function confirmDeposit(gatewayRef: string, success: boolean) {
  if (!gatewayRef) return null;
  const tx = await prisma.transaction.findFirst({
    where: { gatewayRef, status: TransactionStatus.PAYMENT_PENDING },
  });
  if (!tx) return null;

  if (success) {
    const held = await prisma.transaction.update({
      where: { id: tx.id },
      data: { status: TransactionStatus.HELD },
    });
    await logEvent(tx.id, TransactionStatus.PAYMENT_PENDING, TransactionStatus.HELD, 'Payment confirmed — funds captured and locked');
    await recordPayment(held, PaymentKind.DEPOSIT);
    const amount = money(tx.amountCents, tx.currency);
    await notifyBoth(tx.buyerId, tx.sellerId, `Payment of ${amount} confirmed and held safely in escrow for "${tx.description}".`, tx.id);
    return held;
  }

  const cancelled = await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: TransactionStatus.CANCELLED },
  });
  await logEvent(tx.id, TransactionStatus.PAYMENT_PENDING, TransactionStatus.CANCELLED, 'Payment failed or was cancelled by the buyer');
  await notify(tx.buyerId, `Your M-Pesa payment for "${tx.description}" was not completed, so the escrow was cancelled.`, tx.id);
  return cancelled;
}

export async function listMyTransactions(userId: string) {
  return prisma.transaction.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    orderBy: { createdAt: 'desc' },
    include: { events: { orderBy: { createdAt: 'asc' } } },
  });
}

/** Average rating + number of ratings a user has received (seller reputation). */
export async function reputation(userId: string) {
  const ratings = await prisma.rating.findMany({ where: { rateeId: userId }, select: { score: true } });
  const count = ratings.length;
  const average = count ? Math.round((ratings.reduce((s, r) => s + r.score, 0) / count) * 10) / 10 : null;
  return { average, count };
}

export async function getTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      dispute: { include: { evidence: true } },
      rating: true,
      seller: { select: { id: true, email: true, fullName: true } },
    },
  });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId && tx.sellerId !== userId) throw new HttpError(403, 'Not your transaction');
  return { ...tx, sellerReputation: await reputation(tx.sellerId) };
}

/** Seller marks the item as shipped (HELD -> SHIPPED). */
export async function markShipped(userId: string, transactionId: string, note?: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.sellerId !== userId) throw new HttpError(403, 'Only the seller can update shipping');
  if (tx.status !== TransactionStatus.HELD) throw new HttpError(409, `Cannot mark shipped from status ${tx.status}`);

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: TransactionStatus.SHIPPED } });
  await logEvent(transactionId, TransactionStatus.HELD, TransactionStatus.SHIPPED, note ? `Shipped — ${note}` : 'Seller marked as shipped');
  await notify(tx.buyerId, `Your order "${tx.description}" has been shipped by the seller.`, transactionId);
  return updated;
}

/** Seller marks the item as delivered (SHIPPED -> DELIVERED). */
export async function markDelivered(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.sellerId !== userId) throw new HttpError(403, 'Only the seller can update shipping');
  if (tx.status !== TransactionStatus.SHIPPED) throw new HttpError(409, `Cannot mark delivered from status ${tx.status}`);

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: TransactionStatus.DELIVERED } });
  await logEvent(transactionId, TransactionStatus.SHIPPED, TransactionStatus.DELIVERED, 'Seller marked as delivered');
  await notify(tx.buyerId, `Your order "${tx.description}" is marked delivered. Please confirm receipt to release payment.`, transactionId);
  return updated;
}

/** Buyer confirms receipt: releases held funds to the seller (from HELD/SHIPPED/DELIVERED). */
export async function confirmReceived(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId) throw new HttpError(403, 'Only the buyer can confirm receipt');
  if (!HELD_STATES.includes(tx.status)) {
    throw new HttpError(409, `Cannot release funds from status ${tx.status}`);
  }

  const gateway = getGateway(tx.method);
  await gateway.release({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });

  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.RELEASED },
  });
  await logEvent(transactionId, tx.status, TransactionStatus.RELEASED, 'Buyer confirmed receipt');
  await recordPayment(tx, PaymentKind.RELEASE);
  await notifyBoth(tx.buyerId, tx.sellerId, `The buyer confirmed receipt — ${money(tx.amountCents, tx.currency)} has been released to the seller.`, transactionId);
  return updated;
}

/** Called by the dispute module once an admin rules on a case. */
export async function applyDisputeRuling(
  transactionId: string,
  ruling: 'RELEASE' | 'REFUND'
) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.status !== TransactionStatus.DISPUTED) {
    throw new HttpError(409, `Cannot rule on a transaction in status ${tx.status}`);
  }

  const gateway = getGateway(tx.method);
  const toStatus = ruling === 'RELEASE' ? TransactionStatus.RELEASED : TransactionStatus.REFUNDED;

  if (ruling === 'RELEASE') {
    await gateway.release({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });
  } else {
    await gateway.refund({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });
  }

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: { status: toStatus } });
  await logEvent(transactionId, TransactionStatus.DISPUTED, toStatus, `Admin ruling: ${ruling}`);
  await recordPayment(tx, ruling === 'RELEASE' ? PaymentKind.RELEASE : PaymentKind.REFUND);
  const outcome = ruling === 'RELEASE'
    ? `released to the seller`
    : `refunded to the buyer`;
  await notifyBoth(tx.buyerId, tx.sellerId, `An admin resolved the dispute: ${money(tx.amountCents, tx.currency)} has been ${outcome}.`, transactionId);
  return updated;
}

export async function markDisputed(transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.status !== TransactionStatus.HELD) {
    throw new HttpError(409, 'Only a held transaction can be disputed');
  }
  const updated = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.DISPUTED },
  });
  await logEvent(transactionId, TransactionStatus.HELD, TransactionStatus.DISPUTED, 'Dispute opened');
  await notifyBoth(tx.buyerId, tx.sellerId, `A dispute was opened on your ${money(tx.amountCents, tx.currency)} escrow. Funds stay locked until an admin resolves it.`, transactionId);
  return updated;
}

/**
 * Buyer edits a deal before the seller ships.
 * Description is editable while CREATED/PAYMENT_PENDING/HELD; the amount only
 * while the money is not yet locked in escrow.
 */
export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: { description?: string; amountCents?: number }
) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId) throw new HttpError(403, 'Only the buyer can edit this escrow');

  const editable: TransactionStatus[] = [
    TransactionStatus.CREATED,
    TransactionStatus.PAYMENT_PENDING,
    TransactionStatus.HELD,
  ];
  if (!editable.includes(tx.status)) {
    throw new HttpError(409, `Cannot edit an escrow in status ${tx.status}`);
  }

  const patch: { description?: string; amountCents?: number } = {};
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.amountCents !== undefined) {
    if (tx.status === TransactionStatus.HELD) {
      throw new HttpError(409, 'The amount cannot change once funds are held in escrow');
    }
    patch.amountCents = data.amountCents;
  }
  if (Object.keys(patch).length === 0) return tx;

  const updated = await prisma.transaction.update({ where: { id: transactionId }, data: patch });
  await logEvent(transactionId, tx.status, tx.status, 'Buyer updated the escrow details');
  await notify(
    tx.sellerId,
    `The buyer updated the escrow "${updated.description}" (${money(updated.amountCents, updated.currency)}).`,
    transactionId
  );
  return updated;
}

/**
 * Cancels a deal before the seller ships. If the money is already held it is
 * refunded to the buyer first. The record is kept (status CANCELLED) for audit.
 */
export async function cancelTransaction(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId && tx.sellerId !== userId) throw new HttpError(403, 'Not your transaction');

  const cancellable: TransactionStatus[] = [
    TransactionStatus.CREATED,
    TransactionStatus.PAYMENT_PENDING,
    TransactionStatus.HELD,
  ];
  if (!cancellable.includes(tx.status)) {
    throw new HttpError(409, `Cannot cancel an escrow in status ${tx.status}`);
  }

  const wasHeld = tx.status === TransactionStatus.HELD;
  if (wasHeld) {
    const gateway = getGateway(tx.method);
    await gateway.refund({ gatewayRef: tx.gatewayRef!, amountCents: tx.amountCents });
  }

  const cancelled = await prisma.transaction.update({
    where: { id: transactionId },
    data: { status: TransactionStatus.CANCELLED },
  });
  if (wasHeld) await recordPayment(tx, PaymentKind.REFUND);

  const by = tx.buyerId === userId ? 'buyer' : 'seller';
  await logEvent(transactionId, tx.status, TransactionStatus.CANCELLED, `Cancelled by the ${by}`);
  const note = wasHeld
    ? `The escrow "${tx.description}" was cancelled by the ${by} — ${money(tx.amountCents, tx.currency)} has been refunded to the buyer.`
    : `The escrow "${tx.description}" was cancelled by the ${by}.`;
  await notifyBoth(tx.buyerId, tx.sellerId, note, transactionId);
  return cancelled;
}