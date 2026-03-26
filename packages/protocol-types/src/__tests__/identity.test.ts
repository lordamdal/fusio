import { describe, it, expect } from 'vitest';
import { generateKeypair, signPayload, verifySignature } from '../identity.js';

describe('identity', () => {
  it('generates a valid keypair', () => {
    const keypair = generateKeypair();
    expect(keypair.identity.agentId).toBeTruthy();
    expect(keypair.identity.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.identity.publicKey.length).toBe(32);
    expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    expect(keypair.privateKey.length).toBe(32);
    expect(keypair.identity.createdAt).toBeGreaterThan(0);
  });

  it('signs and verifies a payload', () => {
    const keypair = generateKeypair();
    const payload = { message: 'hello fusio', value: 42 };
    const signed = signPayload(payload, keypair);

    expect(signed.payload).toBe(JSON.stringify(payload));
    expect(signed.signature).toBeTruthy();
    expect(signed.agentId).toBe(keypair.identity.agentId);

    const valid = verifySignature(signed, keypair.identity.publicKey);
    expect(valid).toBe(true);
  });

  it('rejects tampered payload', () => {
    const keypair = generateKeypair();
    const payload = { message: 'hello fusio' };
    const signed = signPayload(payload, keypair);

    // Tamper with payload
    signed.payload = JSON.stringify({ message: 'tampered' });
    const valid = verifySignature(signed, keypair.identity.publicKey);
    expect(valid).toBe(false);
  });

  it('rejects wrong public key', () => {
    const keypair1 = generateKeypair();
    const keypair2 = generateKeypair();
    const payload = { message: 'test' };
    const signed = signPayload(payload, keypair1);

    const valid = verifySignature(signed, keypair2.identity.publicKey);
    expect(valid).toBe(false);
  });
});
