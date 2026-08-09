import { PaymentGateway } from './gateway.types';
import { SIMULATE_PAYMENTS, fakeRef } from './simulate';

// Visa card processing goes through Stripe (PCI compliance, 3-D Secure, etc.
// are handled by Stripe rather than us touching raw card numbers).
const BASE_URL = process.env.STRIPE_BASE_URL ?? 'https://api.stripe.com/v1';

function authHeader() {
  return { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` };
}

export const visaGateway: PaymentGateway = {
  async deposit({ amountCents, currency, reference }) {
    if (SIMULATE_PAYMENTS) return { gatewayRef: fakeRef('VISA') };

    const body = new URLSearchParams({
      amount: String(amountCents),
      currency: currency.toLowerCase(),
      'payment_method_types[]': 'card',
      'metadata[reference]': reference,
      capture_method: 'manual', // authorize now, capture on release (holds funds without paying seller)
    });
    const res = await fetch(`${BASE_URL}/payment_intents`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Stripe payment intent failed: ${res.status}`);
    const intent = (await res.json()) as { id: string; client_secret: string };
    // Frontend uses client_secret with Stripe.js to collect the card and confirm the intent.
    return { gatewayRef: intent.id, raw: intent };
  },

  async release({ gatewayRef }) {
    if (SIMULATE_PAYMENTS) return;
    // Capturing the manually-authorized intent finalizes payment to the platform's
    // Stripe balance; paying the seller out is a separate Stripe Connect transfer.
    const res = await fetch(`${BASE_URL}/payment_intents/${gatewayRef}/capture`, {
      method: 'POST',
      headers: authHeader(),
    });
    if (!res.ok) throw new Error(`Stripe capture failed: ${res.status}`);
  },

  async refund({ gatewayRef }) {
    if (SIMULATE_PAYMENTS) return;
    const body = new URLSearchParams({ payment_intent: gatewayRef });
    const res = await fetch(`${BASE_URL}/refunds`, {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) throw new Error(`Stripe refund failed: ${res.status}`);
  },
};
