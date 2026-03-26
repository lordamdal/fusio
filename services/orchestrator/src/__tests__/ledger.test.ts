import { describe, it, expect, beforeEach } from 'vitest';
import * as ledger from '../core/ledger.js';

describe('Ledger', () => {
  beforeEach(() => {
    ledger.clearAll();
    ledger.seedBalance('requester', 100);
    ledger.seedBalance('worker', 0);
  });

  it('should lock escrow and deduct balance', () => {
    const ok = ledger.lockEscrow('job-1', 'requester', 'worker', 10);
    expect(ok).toBe(true);
    expect(ledger.getBalance('requester')).toBe(90);
    expect(ledger.getEscrow('job-1')).toEqual({ amount: 10, from: 'requester', to: 'worker' });
  });

  it('should release escrow to worker', () => {
    ledger.lockEscrow('job-1', 'requester', 'worker', 10);
    const released = ledger.releaseEscrow('job-1');
    expect(released).toBe(true);
    expect(ledger.getBalance('worker')).toBe(10);
    expect(ledger.getEscrow('job-1')).toBeUndefined();
  });

  it('should return escrow to requester', () => {
    ledger.lockEscrow('job-1', 'requester', 'worker', 10);
    const returned = ledger.returnEscrow('job-1');
    expect(returned).toBe(true);
    expect(ledger.getBalance('requester')).toBe(100);
    expect(ledger.getEscrow('job-1')).toBeUndefined();
  });

  it('should reject double-lock on same jobId', () => {
    const ok1 = ledger.lockEscrow('job-1', 'requester', 'worker', 10);
    const ok2 = ledger.lockEscrow('job-1', 'requester', 'worker', 10);
    expect(ok1).toBe(true);
    expect(ok2).toBe(false);
  });

  it('should reject lock when balance insufficient', () => {
    const ok = ledger.lockEscrow('job-1', 'requester', 'worker', 200);
    expect(ok).toBe(false);
    expect(ledger.getBalance('requester')).toBe(100);
  });
});
