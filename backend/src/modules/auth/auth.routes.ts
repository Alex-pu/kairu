import { Router } from 'express';
import { z } from 'zod';
import * as authService from './auth.service';

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, 'Please enter your full name'),
  // M-Pesa number — the payout destination. Kept lenient on format (07…, 2547…, +2547…).
  phone: z.string().trim().min(10, 'Please enter a valid phone number').max(20),
});

authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, fullName, phone } = registerSchema.parse(req.body);
    const result = await authService.register(email, password, fullName, phone);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
});
