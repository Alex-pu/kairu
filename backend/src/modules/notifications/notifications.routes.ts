import { Router } from 'express';
import { requireAuth, AuthedRequest } from '../../common/middleware/auth.middleware';
import * as notifications from './notifications.service';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req: AuthedRequest, res, next) => {
  try {
    const [items, unread] = await Promise.all([
      notifications.listForUser(req.user!.id),
      notifications.unreadCount(req.user!.id),
    ]);
    res.json({ unread, items });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/read-all', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await notifications.markAllRead(req.user!.id));
  } catch (err) {
    next(err);
  }
});

notificationsRouter.post('/:id/read', async (req: AuthedRequest, res, next) => {
  try {
    res.json(await notifications.markRead(req.user!.id, req.params.id));
  } catch (err) {
    next(err);
  }
});
