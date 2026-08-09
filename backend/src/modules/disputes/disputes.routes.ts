import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin, AuthedRequest } from '../../common/middleware/auth.middleware';
import * as disputesService from './disputes.service';

export const disputesRouter = Router();
disputesRouter.use(requireAuth);

const openSchema = z.object({
  transactionId: z.string().uuid(),
  reason: z.string().min(3).max(1000),
  evidenceUrls: z.array(z.string().url()).default([]),
});

disputesRouter.post('/', async (req: AuthedRequest, res, next) => {
  try {
    const body = openSchema.parse(req.body);
    const dispute = await disputesService.openDispute(req.user!.id, body.transactionId, body.reason, body.evidenceUrls);
    res.status(201).json(dispute);
  } catch (err) {
    next(err);
  }
});

disputesRouter.post('/:id/evidence', async (req: AuthedRequest, res, next) => {
  try {
    const { fileUrl } = z.object({ fileUrl: z.string().url() }).parse(req.body);
    res.status(201).json(await disputesService.addEvidence(req.user!.id, req.params.id, fileUrl));
  } catch (err) {
    next(err);
  }
});

// Admin-only: queue of open cases and the ruling action.
disputesRouter.get('/', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await disputesService.listOpenDisputes());
  } catch (err) {
    next(err);
  }
});

const rulingSchema = z.object({
  ruling: z.enum(['RELEASE', 'REFUND']),
  adminNote: z.string().max(1000).optional(),
});

disputesRouter.post('/:id/rule', requireAdmin, async (req, res, next) => {
  try {
    const { ruling, adminNote } = rulingSchema.parse(req.body);
    res.json(await disputesService.ruleOnDispute(req.params.id, ruling, adminNote));
  } catch (err) {
    next(err);
  }
});
