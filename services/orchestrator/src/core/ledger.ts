const balances = new Map<string, number>();
const escrows = new Map<string, { amount: number; from: string; to: string }>();

export function seedBalance(accountId: string, amount: number): void {
  balances.set(accountId, amount);
}

export function getBalance(accountId: string): number {
  return balances.get(accountId) ?? 0;
}

export function getEscrow(jobId: string): { amount: number; from: string; to: string } | undefined {
  return escrows.get(jobId);
}

/** Default starting balance for new accounts (testnet). */
const DEFAULT_SEED_BALANCE = 1000;

export function lockEscrow(jobId: string, from: string, to: string, amount: number): boolean {
  if (escrows.has(jobId)) {
    return false; // Double-lock rejected
  }
  // Auto-seed new accounts on testnet
  if (!balances.has(from)) {
    balances.set(from, DEFAULT_SEED_BALANCE);
  }
  const balance = getBalance(from);
  if (balance < amount) {
    return false; // Insufficient balance
  }
  balances.set(from, balance - amount);
  escrows.set(jobId, { amount, from, to });
  return true;
}

export function releaseEscrow(jobId: string): boolean {
  const escrow = escrows.get(jobId);
  if (!escrow) return false;
  const toBalance = getBalance(escrow.to);
  balances.set(escrow.to, toBalance + escrow.amount);
  escrows.delete(jobId);
  return true;
}

export function returnEscrow(jobId: string): boolean {
  const escrow = escrows.get(jobId);
  if (!escrow) return false;
  const fromBalance = getBalance(escrow.from);
  balances.set(escrow.from, fromBalance + escrow.amount);
  escrows.delete(jobId);
  return true;
}

export function clearAll(): void {
  balances.clear();
  escrows.clear();
}
