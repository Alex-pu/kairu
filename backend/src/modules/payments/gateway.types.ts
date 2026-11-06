export interface DepositResult {
  gatewayRef: string;
  /**
   * True when funds are NOT captured synchronously: the transaction stays in
   * PAYMENT_PENDING until an out-of-band webhook confirms it (e.g. an M-Pesa STK
   * push the buyer must approve on their phone). Omit/false = captured immediately.
   */
  pending?: boolean;
  raw?: unknown;
}

/** A transfer can be accepted synchronously but settle later through a gateway callback. */
export interface OperationResult {
  pending?: boolean;
  /** Merchant-generated correlation id returned in the final gateway callback. */
  requestRef?: string;
}

export interface PaymentGateway {
  /** Capture funds from the buyer into escrow (moves PAYMENT_PENDING -> HELD). */
  deposit(params: { amountCents: number; currency: string; reference: string; payerPhone?: string }): Promise<DepositResult>;
  /** Pay held funds out to the seller (moves HELD -> RELEASED). */
  release(params: { gatewayRef: string; amountCents: number; recipientPhone?: string; requestRef?: string }): Promise<void | OperationResult>;
  /** Return held funds to the buyer (moves HELD/DISPUTED -> REFUNDED). */
  refund(params: { gatewayRef: string; amountCents: number; recipientPhone?: string; requestRef?: string }): Promise<void | OperationResult>;
}
