import { Router } from 'express';
import * as escrowService from '../escrow/escrow.service';

export const webhooksRouter = Router();

function stkReceipt(cb: any): string | undefined {
  const items = cb?.CallbackMetadata?.Item;
  if (!Array.isArray(items)) return undefined;
  return items.find((item: any) => item?.Name === 'MpesaReceiptNumber')?.Value;
}

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
webhooksRouter.post('/mpesa/stk', async (req, res) => {
  try {
    const cb = req.body?.Body?.stkCallback;
    if (cb?.CheckoutRequestID != null) {
      const success = Number(cb.ResultCode) === 0;
      await escrowService.confirmDeposit(String(cb.CheckoutRequestID), success, stkReceipt(cb));
    }
  } catch (err) {
    // Log for ops but still acknowledge, so Daraja doesn't hammer retries.
    console.error('M-Pesa webhook processing error:', err);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

/** Final B2C payment/reversal result. An accepted B2C request is not a completed transfer. */
async function handleB2CResult(req: any, res: any) {
  try {
    const result = req.body?.Result;
    if (result?.OriginatorConversationID) {
      await escrowService.confirmPayout(
        String(result.OriginatorConversationID),
        Number(result.ResultCode) === 0,
        result.TransactionID ? String(result.TransactionID) : undefined
      );
    }
  } catch (err) {
    console.error('M-Pesa B2C callback processing error:', err);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
}

webhooksRouter.post('/mpesa/b2c/result', handleB2CResult);
webhooksRouter.post('/mpesa/b2c/timeout', async (req, res) => {
  try {
    const ref = req.body?.Result?.OriginatorConversationID ?? req.body?.OriginatorConversationID;
    if (ref) await escrowService.confirmPayout(String(ref), false);
  } catch (err) {
    console.error('M-Pesa B2C timeout processing error:', err);
  }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Compatibility for existing sandbox URLs. New production deployments use /mpesa/stk.
webhooksRouter.post('/mpesa', async (req, res) => {
  req.url = '/mpesa/stk';
  const cb = req.body?.Body?.stkCallback;
  try {
    if (cb?.CheckoutRequestID != null) await escrowService.confirmDeposit(String(cb.CheckoutRequestID), Number(cb.ResultCode) === 0, stkReceipt(cb));
  } catch (err) { console.error('M-Pesa webhook processing error:', err); }
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});
