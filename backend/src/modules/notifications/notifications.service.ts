import nodemailer from 'nodemailer';
import { prisma } from '../../prisma';

/**
 * Persists an in-app notification for a user and (best-effort) emails them.
 * Called from the escrow/dispute flows whenever a transaction changes state, so both
 * parties are actively notified rather than having to poll their transaction list.
 */
export async function notify(userId: string, message: string, transactionId?: string) {
  const notification = await prisma.notification.create({
    data: { userId, message, transactionId },
  });
  // Fire-and-forget email; never let a delivery failure break the escrow flow.
  void sendEmail(userId, message).catch((err) => console.error('Email notification failed:', err));
  return notification;
}

/** Notify both sides of a transaction with the same message. */
export async function notifyBoth(buyerId: string, sellerId: string, message: string, transactionId?: string) {
  await Promise.all([notify(buyerId, message, transactionId), notify(sellerId, message, transactionId)]);
}

export async function listForUser(userId: string) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}

export async function markRead(userId: string, id: string) {
  // Scope the update to the owner so a user can't mark someone else's notification read.
  await prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
  return { ok: true };
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  return { ok: true };
}

/**
 * Sends an email when SMTP is configured (SMTP_URL + NOTIFY_FROM). Without config it no-ops,
 * so local/dev and the simulated flow run without any mail server. Uses nodemailer if present.
 */
async function sendEmail(userId: string, message: string) {
  if (!process.env.SMTP_URL) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return;

  const transport = nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({
    from: process.env.NOTIFY_FROM || 'no-reply@safepay.local',
    to: user.email,
    subject: 'SafePay Escrow update',
    text: message,
  });
}
