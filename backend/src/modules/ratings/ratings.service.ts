import { TransactionStatus } from '@prisma/client';
import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';

export async function rateTransaction(userId: string, transactionId: string, score: number, comment?: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) throw new HttpError(404, 'Transaction not found');
  if (tx.buyerId !== userId && tx.sellerId !== userId) throw new HttpError(403, 'Not your transaction');
  if (tx.status !== TransactionStatus.RELEASED) {
    throw new HttpError(409, 'Can only rate a completed (released) transaction');
  }

  const rateeId = tx.buyerId === userId ? tx.sellerId : tx.buyerId;

  return prisma.rating.create({
    data: { transactionId, raterId: userId, rateeId, score, comment },
  });
}

export async function getUserRatings(userId: string) {
  const ratings = await prisma.rating.findMany({ where: { rateeId: userId }, orderBy: { createdAt: 'desc' } });
  const average = ratings.length ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length : null;
  return { average, count: ratings.length, ratings };
}
