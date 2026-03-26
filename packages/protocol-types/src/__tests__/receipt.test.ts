import { describe, it, expect } from 'vitest';
import { generateKeypair, bytesToHex } from '../identity.js';
import { createReceipt, signReceiptAsAgent, signReceiptAsWorker, verifyReceipt } from '../receipt.js';
import type { CompletionReceipt } from '../receipt.js';
import { createHash } from 'node:crypto';

describe('receipt', () => {
  it('creates a receipt with correct duration', () => {
    const receipt = createReceipt({
      jobId: 'job-1',
      agentId: 'agent-1',
      workerIdHash: createHash('sha256').update('worker-1').digest('hex'),
      jobHash: createHash('sha256').update('{}').digest('hex'),
      startedAt: 1000,
      completedAt: 5000,
      actionCount: 10,
      outcome: 'completed',
      faultClass: 'none',
      costAgr: 1.0,
      wipeHash: createHash('sha256').update('mock_wipe_job-1').digest('hex'),
    });

    expect(receipt.receiptId).toBeTruthy();
    expect(receipt.durationMs).toBe(4000);
    expect(receipt.outcome).toBe('completed');
  });

  it('signs receipt as agent and worker, then verifies', () => {
    const agentKeypair = generateKeypair();
    const workerKeypair = generateKeypair();

    const baseReceipt = createReceipt({
      jobId: 'job-2',
      agentId: agentKeypair.identity.agentId,
      workerIdHash: createHash('sha256').update(bytesToHex(workerKeypair.identity.publicKey)).digest('hex'),
      jobHash: createHash('sha256').update('manifest').digest('hex'),
      startedAt: 1000,
      completedAt: 3000,
      actionCount: 5,
      outcome: 'completed',
      faultClass: 'none',
      costAgr: 1.0,
      wipeHash: createHash('sha256').update('mock_wipe_job-2').digest('hex'),
    });

    let receipt: CompletionReceipt = {
      ...baseReceipt,
      agentSignature: '',
      workerSignature: '',
    };

    receipt = signReceiptAsAgent(receipt, agentKeypair);
    expect(receipt.agentSignature).toBeTruthy();

    receipt = signReceiptAsWorker(receipt, workerKeypair);
    expect(receipt.workerSignature).toBeTruthy();

    const valid = verifyReceipt(receipt, agentKeypair.identity.publicKey, workerKeypair.identity.publicKey);
    expect(valid).toBe(true);
  });
});
