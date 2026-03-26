import { describe, it, expect } from 'vitest';
import { generateKeypair } from '../identity.js';
import { createManifest, validateManifest } from '../manifest.js';

describe('manifest', () => {
  it('creates a valid manifest', () => {
    const keypair = generateKeypair();
    const manifest = createManifest({
      agentId: keypair.identity.agentId,
      capability: 'browser.full',
      estimatedMinutes: 5,
      maxPriceAgr: 1.0,
      browser: 'chromium',
      declaredPurpose: 'Test navigation',
      category: 'test.ping',
      memoryPolicy: 'ephemeral',
      failoverPolicy: 'abort',
      url: 'https://example.com',
    }, keypair);

    expect(manifest.jobId).toBeTruthy();
    expect(manifest.agentSignature).toBeTruthy();
    expect(manifest.createdAt).toBeGreaterThan(0);
  });

  it('validates a correct manifest', () => {
    const keypair = generateKeypair();
    const manifest = createManifest({
      agentId: keypair.identity.agentId,
      capability: 'browser.full',
      estimatedMinutes: 5,
      maxPriceAgr: 1.0,
      browser: 'chromium',
      declaredPurpose: 'Test',
      category: 'test.ping',
      memoryPolicy: 'ephemeral',
      failoverPolicy: 'abort',
    }, keypair);

    const result = validateManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects prohibited category', () => {
    const keypair = generateKeypair();
    const manifest = createManifest({
      agentId: keypair.identity.agentId,
      capability: 'browser.full',
      estimatedMinutes: 5,
      maxPriceAgr: 1.0,
      browser: 'chromium',
      declaredPurpose: 'Test',
      category: 'form.submit',
      memoryPolicy: 'ephemeral',
      failoverPolicy: 'abort',
    }, keypair);

    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('prohibited'))).toBe(true);
  });

  it('detects signature tampering', () => {
    const keypair = generateKeypair();
    const manifest = createManifest({
      agentId: keypair.identity.agentId,
      capability: 'browser.full',
      estimatedMinutes: 5,
      maxPriceAgr: 1.0,
      browser: 'chromium',
      declaredPurpose: 'Test',
      category: 'test.ping',
      memoryPolicy: 'ephemeral',
      failoverPolicy: 'abort',
    }, keypair);

    manifest.agentSignature = 'deadbeef'.repeat(16);
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
  });
});
