import { describe, it, expect } from 'vitest';
import { generateKeypair } from '@fusio/protocol-types';
import type { JobManifest } from '@fusio/protocol-types';
import { buildAndSign } from '../receipt.js';

describe('receipt', () => {
  it('builds and signs a receipt', async () => {
    const workerKeypair = generateKeypair();
    const manifest: JobManifest = {
      jobId: 'test-job-1',
      agentId: 'test-agent-id',
      agentSignature: 'test-sig',
      capability: 'browser.full',
      estimatedMinutes: 5,
      maxPriceAgr: 1.0,
      browser: 'chromium',
      declaredPurpose: 'Test',
      category: 'test.ping',
      memoryPolicy: 'ephemeral',
      failoverPolicy: 'abort',
      createdAt: Date.now(),
    };

    const receipt = await buildAndSign(
      'test-job-1',
      manifest,
      { startedAt: Date.now() - 5000, actionCount: 3, wipeHash: 'abc123' },
      workerKeypair
    );

    expect(receipt.receiptId).toBeTruthy();
    expect(receipt.jobId).toBe('test-job-1');
    expect(receipt.outcome).toBe('completed');
    expect(receipt.faultClass).toBe('none');
    expect(receipt.actionCount).toBe(3);
    expect(receipt.workerSignature).toBeTruthy();
    expect(receipt.workerSignature).not.toBe('');
    expect(receipt.agentSignature).toBe('PENDING_ORCHESTRATOR_SIGN');
    expect(receipt.durationMs).toBeGreaterThan(0);
  });
});
