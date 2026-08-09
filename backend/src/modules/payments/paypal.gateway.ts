import { PaymentGateway } from './gateway.types';
import { SIMULATE_PAYMENTS, fakeRef } from './simulate';

const BASE_URL = process.env.PAYPAL_BASE_URL ?? 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID!;
  const secret = process.env.PAYPAL_CLIENT_SECRET!;
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export const paypalGateway: PaymentGateway = {
  async deposit({ amountCents, currency, reference }) {
    if (SIMULATE_PAYMENTS) return { gatewayRef: fakeRef('PAYPAL') };

    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: reference,
            amount: { currency_code: currency, value: (amountCents / 100).toFixed(2) },
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`PayPal order creation failed: ${res.status}`);
    const order = (await res.json()) as { id: string };
    // NOTE: real flow requires the buyer to approve the order in the PayPal UI
    // before it can be captured. The frontend redirects to order.links[approve],
    // then calls POST /v2/checkout/orders/{id}/capture on return.
    return { gatewayRef: order.id, raw: order };
  },

  async release({ gatewayRef, amountCents }) {
    if (SIMULATE_PAYMENTS) return;
    // Payout to seller via PayPal Payouts API using the captured order's funds.
    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/v1/payments/payouts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_batch_header: { sender_batch_id: `release_${gatewayRef}` },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: { value: (amountCents / 100).toFixed(2), currency: 'USD' },
            note: `Escrow release for ${gatewayRef}`,
            receiver: process.env.PAYPAL_PAYOUT_PLACEHOLDER_EMAIL, // replace with seller's PayPal email at call site
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`PayPal payout failed: ${res.status}`);
  },

  async refund({ gatewayRef }) {
    if (SIMULATE_PAYMENTS) return;
    const token = await getAccessToken();
    // Requires the capture id (obtained during the capture step) rather than the order id.
    const res = await fetch(`${BASE_URL}/v2/payments/captures/${gatewayRef}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`PayPal refund failed: ${res.status}`);
  },
};
