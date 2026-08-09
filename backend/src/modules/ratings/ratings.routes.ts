import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../../common/middleware/auth.middleware';
import * as ratingsService from './ratings.service';

export const ratingsRouter = Router();
ratingsRouter.use(requireAuth);

const rateSchema = z.object({
  transactionId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

ratingsRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const { transactionId, score, comment } = rateSchema.parse(req.body);
    res.status(201).json(await ratingsService.rateTransaction(req.user!.id, transactionId, score, comment));
  } catch (err) {
    next(err);
  }
});

ratingsRouter.get('/users/:userId', async (req, res, next) => {
  try {
    res.json(await ratingsService.getUserRatings(req.params.userId));
  } catch (err) {
    next(err);
  }
});
