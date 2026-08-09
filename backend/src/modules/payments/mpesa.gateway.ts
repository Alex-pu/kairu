import { PaymentGateway } from './gateway.types';
import { SIMULATE_PAYMENTS, fakeRef } from './simulate';

const BASE_URL = process.env.MPESA_BASE_URL ?? 'https://sandbox.safaricom.co.ke';

async function getAccessToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  const res = await fetch(`${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
  });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function timestamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export const mpesaGateway: PaymentGateway = {
  async deposit({ amountCents, reference }) {
    if (SIMULATE_PAYMENTS) return { gatewayRef: fakeRef('MPESA') };

    const shortcode = process.env.MPESA_SHORTCODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString('base64');
    const token = await getAccessToken();

    // STK Push: prompts the buyer's phone to enter their M-Pesa PIN.
    // The buyer's phone number must be collected separately and passed in here.
    const res = await fetch(`${BASE_URL}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amountCents / 100),
        PartyA: process.env.MPESA_TEST_MSISDN, // buyer phone number, sandbox test number for now
        PartyB: shortcode,
        PhoneNumber: process.env.MPESA_TEST_MSISDN,
        CallBackURL: process.env.MPESA_CALLBACK_URL,
        AccountReference: reference,
        TransactionDesc: 'Escrow deposit',
      }),
    });
    if (!res.ok) throw new Error(`Daraja STK push failed: ${res.status}`);
    const data = (await res.json()) as { CheckoutRequestID: string };
    // Actual payment confirmation arrives asynchronously at CallBackURL — the
    // transaction stays PAYMENT_PENDING until our /api/webhooks/mpesa handler fires.
    return { gatewayRef: data.CheckoutRequestID, pending: true, raw: data };
  },

  async release({ amountCents }) {
    if (SIMULATE_PAYMENTS) return;
    // Payout to the seller via Daraja B2C. Needs a B2C-enabled shortcode + initiator
    // security credential (provisioned by Safaricom on the production app). The seller's
    // phone number (PartyB) should be collected at escrow creation.
    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        InitiatorName: process.env.MPESA_INITIATOR_NAME,
        SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
        CommandID: 'BusinessPayment',
        Amount: Math.round(amountCents / 100),
        PartyA: process.env.MPESA_B2C_SHORTCODE ?? process.env.MPESA_SHORTCODE,
        PartyB: process.env.MPESA_TEST_MSISDN,
        Remarks: 'Escrow release',
        QueueTimeOutURL: process.env.MPESA_CALLBACK_URL,
        ResultURL: process.env.MPESA_CALLBACK_URL,
      }),
    });
    if (!res.ok) throw new Error(`Daraja B2C payout failed: ${res.status}`);
  },

  async refund({ gatewayRef, amountCents }) {
    if (SIMULATE_PAYMENTS) return;
    // Return funds to the buyer via the Daraja Transaction Reversal API.
    const token = await getAccessToken();
    const res = await fetch(`${BASE_URL}/mpesa/reversal/v1/request`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Initiator: process.env.MPESA_INITIATOR_NAME,
        SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
        CommandID: 'TransactionReversal',
        TransactionID: gatewayRef,
        Amount: Math.round(amountCents / 100),
        ReceiverParty: process.env.MPESA_SHORTCODE,
        RecieverIdentifierType: '11',
        ResultURL: process.env.MPESA_CALLBACK_URL,
        QueueTimeOutURL: process.env.MPESA_CALLBACK_URL,
        Remarks: 'Escrow refund',
      }),
    });
    if (!res.ok) throw new Error(`Daraja reversal failed: ${res.status}`);
  },
};
