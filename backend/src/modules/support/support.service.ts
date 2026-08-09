import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';
import { notify } from '../notifications/notifications.service';

/**
 * Customer-care chat. Each user has exactly one conversation with the support
 * team; admins answer from the admin dashboard. Messages live in our own database
 * rather than a third-party widget, so support history stays alongside the
 * transactions and disputes it refers to.
 */

/** The customer's own conversation, oldest first, plus how many staff replies they haven't seen. */
export async function listForUser(userId: string) {
  const [items, unread] = await Promise.all([
    prisma.supportMessage.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    unreadForUser(userId),
  ]);
  return { items, unread };
}

export async function unreadForUser(userId: string) {
  return prisma.supportMessage.count({ where: { userId, fromAdmin: true, readByUser: false } });
}

/** Customer sends a message to support. */
export async function sendAsUser(userId: string, body: string) {
  return prisma.supportMessage.create({
    // The sender has obviously read their own message; support has not.
    data: { userId, body, fromAdmin: false, readByUser: true, readByAdmin: false },
  });
}

/** Marks every staff reply in the customer's thread as seen. */
export async function markReadByUser(userId: string) {
  await prisma.supportMessage.updateMany({
    where: { userId, fromAdmin: true, readByUser: false },
    data: { readByUser: true },
  });
  return { ok: true };
}

/**
 * Admin inbox: one row per customer who has ever written in, most recently
 * active first, with the last message and the number still awaiting a reply.
 */
export async function listThreads() {
  const grouped = await prisma.supportMessage.groupBy({
    by: ['userId'],
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
    take: 100,
  });
  const userIds = grouped.map((g) => g.userId);
  if (!userIds.length) return [];

  // Two bulk queries instead of one per thread, so the inbox stays flat-cost.
  const [users, unreadCounts, lastMessages] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    }),
    prisma.supportMessage.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds }, fromAdmin: false, readByAdmin: false },
      _count: true,
    }),
    prisma.supportMessage.findMany({
      where: { userId: { in: userIds } },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, body: true, fromAdmin: true, createdAt: true },
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const unreadById = new Map(unreadCounts.map((c) => [c.userId, c._count]));
  const lastById = new Map<string, (typeof lastMessages)[number]>();
  for (const m of lastMessages) if (!lastById.has(m.userId)) lastById.set(m.userId, m);

  return grouped.map((g) => ({
    user: userById.get(g.userId) ?? { id: g.userId, email: '(deleted user)', fullName: null },
    lastMessage: lastById.get(g.userId) ?? null,
    lastAt: g._max.createdAt,
    unread: unreadById.get(g.userId) ?? 0,
  }));
}

/** Total messages awaiting a staff reply — drives the badge on the admin dashboard. */
export async function unreadForAdmin() {
  return prisma.supportMessage.count({ where: { fromAdmin: false, readByAdmin: false } });
}

/** One customer's conversation for an admin; opening it marks their messages read. */
export async function getThread(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true, phone: true },
  });
  if (!user) throw new HttpError(404, 'No such user');

  const items = await prisma.supportMessage.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });
  await prisma.supportMessage.updateMany({
    where: { userId, fromAdmin: false, readByAdmin: false },
    data: { readByAdmin: true },
  });
  return { user, items };
}

/**
 * Staff reply. Also raises a normal notification so the customer sees it in the
 * bell (and by email when SMTP is configured) even if the chat panel is closed.
 */
export async function replyAsAdmin(userId: string, body: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new HttpError(404, 'No such user');

  const message = await prisma.supportMessage.create({
    data: { userId, body, fromAdmin: true, readByUser: false, readByAdmin: true },
  });
  await notify(userId, 'SafePay support replied to your message.');
  return message;
}
