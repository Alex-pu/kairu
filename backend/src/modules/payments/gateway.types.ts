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

export interface PaymentGateway {
  /** Capture funds from the buyer into escrow (moves PAYMENT_PENDING -> HELD). */
  deposit(params: { amountCents: number; currency: string; reference: string }): Promise<DepositResult>;
  /** Pay held funds out to the seller (moves HELD -> RELEASED). */
  release(params: { gatewayRef: string; amountCents: number }): Promise<void>;
  /** Return held funds to the buyer (moves HELD/DISPUTED -> REFUNDED). */
  refund(params: { gatewayRef: string; amountCents: number }): Promise<void>;
}
