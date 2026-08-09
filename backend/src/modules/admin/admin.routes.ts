import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../common/middleware/auth.middleware';
import * as adminService from './admin.service';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get('/overview', async (_req, res, next) => {
  try {
    res.json(await adminService.getOverview());
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/users', async (_req, res, next) => {
  try {
    res.json(await adminService.listUsers());
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/transactions', async (_req, res, next) => {
  try {
    res.json(await adminService.listAllTransactions());
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/payments', async (_req, res, next) => {
  try {
    res.json(await adminService.listPayments());
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/reviews', async (_req, res, next) => {
  try {
    res.json(await adminService.listReviews());
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/transactions/:id', async (req, res, next) => {
  try {
    res.json(await adminService.getTransaction(req.params.id));
  } catch (err) {
    next(err);
  }
});
