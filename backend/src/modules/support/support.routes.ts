import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, AuthedRequest } from '../../common/middleware/auth.middleware';
import * as support from './support.service';

export const supportRouter = Router();
supportRouter.use(requireAuth);

const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) });

// ---------- customer ----------

supportRouter.get('/messages', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await support.listForUser(req.user!.id));
  } catch (err) {
    next(err);
  }
});

// Cheap poll target for the unread badge — avoids refetching the whole thread.
supportRouter.get('/messages/unread', async (req: AuthedRequest, res, next) => {
  try {
    res.json({ unread: await support.unreadForUser(req.user!.id) });
  } catch (err) {
    next(err);
  }
});

supportRouter.post('/messages', async (req: AuthedRequest, res, next) => {
  try {
    const { body } = messageSchema.parse(req.body);
    res.status(201).json(await support.sendAsUser(req.user!.id, body));
  } catch (err) {
    next(err);
  }
});

supportRouter.post('/messages/read', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await support.markReadByUser(req.user!.id));
  } catch (err) {
    next(err);
  }
});

// ---------- support team ----------
// Mounted under the same router so the whole area sits at /api/support; every
// route below additionally requires an admin token.

supportRouter.get('/threads', requireAdmin, async (_req, res, next) => {
  try {
    const [threads, unread] = await Promise.all([support.listThreads(), support.unreadForAdmin()]);
    res.json({ unread, threads });
  } catch (err) {
    next(err);
  }
});

supportRouter.get('/threads/:userId', requireAdmin, async (req, res, next) => {
  try {
    res.json(await support.getThread(req.params.userId));
  } catch (err) {
    next(err);
  }
});

supportRouter.post('/threads/:userId', requireAdmin, async (req, res, next) => {
  try {
    const { body } = messageSchema.parse(req.body);
    res.status(201).json(await support.replyAsAdmin(req.params.userId, body));
  } catch (err) {
    next(err);
  }
});
