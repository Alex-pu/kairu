import { DisputeStatus, TransactionStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';

// Statuses in which money is still locked in escrow.
const HELD_STATES = [TransactionStatus.HELD, TransactionStatus.SHIPPED, TransactionStatus.DELIVERED];

export async function getOverview() {
  const [heldAgg, openDisputes, userCount, statusCounts] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amountCents: true },
      where: { status: { in: HELD_STATES } },
    }),
    prisma.dispute.count({ where: { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } } }),
    prisma.user.count(),
    prisma.transaction.groupBy({ by: ['status'], _count: true }),
  ]);

  return {
    heldCents: heldAgg._sum.amountCents ?? 0,
    openDisputes,
    userCount,
    byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
  };
}

export async function listUsers() {
  return prisma.user.findMany({
    select: { id: true, email: true, fullName: true, phone: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listAllTransactions() {
  return prisma.transaction.findMany({
    orderBy: { createdAt: 'desc' },
    include: { buyer: { select: { email: true } }, seller: { select: { email: true } } },
  });
}

/** Payment ledger — every deposit/release/refund across the platform. */
export async function listPayments() {
  return prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      transaction: {
        select: {
          id: true,
          description: true,
          currency: true,
          buyer: { select: { email: true } },
          seller: { select: { email: true } },
        },
      },
    },
  });
}

/** Every rating left on the platform (buyer -> seller reviews). */
export async function listReviews() {
  return prisma.rating.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      rater: { select: { email: true } },
      ratee: { select: { email: true } },
      transaction: { select: { id: true, description: true } },
    },
  });
}

/** Full detail for any transaction — admin is not restricted to being a party. */
export async function getTransaction(transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      events: { orderBy: { createdAt: 'asc' } },
      dispute: { include: { evidence: true } },
      rating: true,
      payments: { orderBy: { createdAt: 'asc' } },
      buyer: { select: { id: true, email: true, fullName: true, phone: true } },
      seller: { select: { id: true, email: true, fullName: true, phone: true } },
    },
  });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  return tx;
}
