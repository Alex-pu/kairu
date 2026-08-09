/**
 * Mock payment-gateway server. Mimics the exact HTTP endpoints (and response shapes)
 * that the real PayPal, M-Pesa/Daraja, and Stripe gateway adapters call, so the REAL
 * integration code path (SIMULATE_PAYMENTS=false) can be exercised and verified without
 * any live merchant credentials. Not for production — a test double only.
 */
import http from 'node:http';

const rid = (p) => p + Math.random().toString(36).slice(2, 12);

export function startMockGateways(port) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const send = (obj, code = 200) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      const { method, url } = req;
      const path = url.split('?')[0];

      // ---- M-Pesa / Daraja ----
      if (method === 'GET' && path === '/oauth/v1/generate') return send({ access_token: 'mock-daraja-token', expires_in: '3599' });
      if (method === 'POST' && path === '/mpesa/stkpush/v1/processrequest') {
        const checkoutId = rid('ws_CO_');
        // Simulate Safaricom's asynchronous confirmation: shortly after accepting the
        // push, POST the success callback to the app's CallBackURL (as a real STK does).
        try {
          const cbUrl = JSON.parse(body || '{}').CallBackURL;
          if (cbUrl) {
            setTimeout(() => {
              fetch(cbUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  Body: { stkCallback: { MerchantRequestID: rid('mr_'), CheckoutRequestID: checkoutId, ResultCode: 0, ResultDesc: 'The service request is processed successfully.' } },
                }),
              }).catch(() => {});
            }, 300);
          }
        } catch {}
        return send({ MerchantRequestID: rid('mr_'), CheckoutRequestID: checkoutId, ResponseCode: '0', ResponseDescription: 'Success. Request accepted for processing', CustomerMessage: 'Success' });
      }
      if (method === 'POST' && path === '/mpesa/b2c/v1/paymentrequest')
        return send({ ConversationID: rid('AG_'), OriginatorConversationID: rid('oc_'), ResponseCode: '0', ResponseDescription: 'Accept the service request successfully.' });
      if (method === 'POST' && path === '/mpesa/reversal/v1/request')
        return send({ ConversationID: rid('AG_'), OriginatorConversationID: rid('oc_'), ResponseCode: '0', ResponseDescription: 'Accept the service request successfully.' });

      // ---- PayPal ----
      if (method === 'POST' && path === '/v1/oauth2/token') return send({ access_token: 'mock-paypal-token', token_type: 'Bearer', expires_in: 32400 });
      if (method === 'POST' && path === '/v2/checkout/orders')
        return send({ id: rid('PAYPAL-ORDER-'), status: 'CREATED', links: [{ rel: 'approve', href: `http://localhost:${port}/approve` }] }, 201);
      if (method === 'POST' && path === '/v1/payments/payouts')
        return send({ batch_header: { payout_batch_id: rid('BATCH-'), batch_status: 'PENDING' } }, 201);
      if (method === 'POST' && /^\/v2\/payments\/captures\/[^/]+\/refund$/.test(path))
        return send({ id: rid('REFUND-'), status: 'COMPLETED' }, 201);

      // ---- Stripe ----
      if (method === 'POST' && path === '/v1/payment_intents')
        return send({ id: rid('pi_'), client_secret: rid('pi_') + '_secret', status: 'requires_capture' });
      if (method === 'POST' && /^\/v1\/payment_intents\/[^/]+\/capture$/.test(path))
        return send({ id: path.split('/')[3], status: 'succeeded' });
      if (method === 'POST' && path === '/v1/refunds') return send({ id: rid('re_'), status: 'succeeded' });

      send({ error: `mock: unhandled ${method} ${path}` }, 404);
    });
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

// Allow running standalone: `node scripts/mock-gateways.mjs 6001`
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const port = Number(process.argv[2] || 6001);
  startMockGateways(port).then(() => console.log(`Mock gateways on http://127.0.0.1:${port}`));
}
