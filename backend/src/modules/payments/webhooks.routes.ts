import { Router } from 'express';
import * as escrowService from '../escrow/escrow.service';

export const webhooksRouter = Router();

/**
 * M-Pesa / Daraja STK Push callback. After the buyer approves (or declines) the
 * payment prompt on their phone, Safaricom POSTs the result here. We flip the
 * transaction PAYMENT_PENDING -> HELD on success (ResultCode 0) or -> CANCELLED
 * otherwise. Daraja retries unless we acknowledge with a 200 + accepted body, so
 * we always respond success and never surface internal errors to Safaricom.
 *
 * Public by design (Safaricom is unauthenticated); the CheckoutRequestID acts as
 * the shared secret and confirmDeposit is idempotent against replays.
 */
webhooksRouter.post('/mpesa', async (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback;
    if (cb?.CheckoutRequestID != null) {
      const success = Number(cb.ResultCode) === 0;
      await escrowService.confirmDeposit(String(cb.CheckoutRequestID), success);
    }
  } catch (err) {
    // Log for ops but still acknowledge, so Daraja doesn't hammer retries.
    console.error('M-Pesa webhook processing error:', err);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
