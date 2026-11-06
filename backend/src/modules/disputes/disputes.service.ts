import { DisputeStatus, TransactionStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';
import * as escrowService from '../escrow/escrow.service';

export async function openDispute(userId: string, transactionId: string, reason: string, evidenceUrls: string[]) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId && tx.sellerId !== userId) throw new HttpError(403, 'Not your transaction');

  await escrowService.markDisputed(transactionId);

  const dispute = await prisma.dispute.create({
    data: {
      transactionId,
      openedById: userId,
      reason,
      evidence: { create: evidenceUrls.map((fileUrl) => ({ fileUrl })) },
    },
    include: { evidence: true },
  });
  return dispute;
}

export async function addEvidence(userId: string, disputeId: string, fileUrl: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId }, include: { transaction: true } });
  if (!dispute) throw new HttpError(404, 'Dispute not found');
  if (dispute.transaction.buyerId !== userId && dispute.transaction.sellerId !== userId) {
    throw new HttpError(403, 'Not your dispute');
  }
  return prisma.evidence.create({ data: { disputeId, fileUrl } });
}

export async function listOpenDisputes() {
  return prisma.dispute.findMany({
    where: { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW] } },
    include: { transaction: true, evidence: true, openedBy: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

/** Admin ruling: resolves the dispute and triggers the corresponding fund movement. */
export async function ruleOnDispute(disputeId: string, ruling: 'RELEASE' | 'REFUND', adminNote?: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new HttpError(404, 'Dispute not found');
  if (dispute.status === DisputeStatus.RESOLVED_RELEASE || dispute.status === DisputeStatus.RESOLVED_REFUND) {
    throw new HttpError(409, 'Dispute already resolved');
  }

  const transaction = await escrowService.applyDisputeRuling(dispute.transactionId, ruling);
  const pending = transaction.status === TransactionStatus.RELEASE_PENDING || transaction.status === TransactionStatus.REFUND_PENDING;

  return prisma.dispute.update({
    where: { id: disputeId },
    data: {
      // M-Pesa B2C/reversal is asynchronous; only resolve after the ResultURL confirms it.
      status: pending ? DisputeStatus.UNDER_REVIEW : (ruling === 'RELEASE' ? DisputeStatus.RESOLVED_RELEASE : DisputeStatus.RESOLVED_REFUND),
      adminNote,
      resolvedAt: pending ? null : new Date(),
    },
  });
}
