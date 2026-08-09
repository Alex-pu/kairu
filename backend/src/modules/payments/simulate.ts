// When SIMULATE_PAYMENTS=true (default for local dev with no gateway keys set),
// adapters skip the real network call and return a fake reference instantly.
// Flip it off once real sandbox credentials are in .env.
export const SIMULATE_PAYMENTS = process.env.SIMULATE_PAYMENTS !== 'false';

export function fakeRef(prefix: string) {
  return `${prefix}_SIMULATED_${Math.random().toString(36).slice(2, 10)}`;
}
