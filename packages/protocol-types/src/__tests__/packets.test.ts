import { describe, it, expect } from 'vitest';
import { generateKeypair } from '../identity.js';
import { createActionPacket, createObservationPacket, verifyActionPacket, verifyObservationPacket } from '../packets.js';

describe('packets', () => {
  it('creates and verifies an action packet', () => {
    const keypair = generateKeypair();
    const packet = createActionPacket({
      jobId: 'test-job-1',
      step: 0,
      action: 'navigate',
      target: { url: 'https://example.com' },
      signedBy: keypair.identity.agentId,
    }, keypair);

    expect(packet.signature).toBeTruthy();
    expect(packet.sentAt).toBeGreaterThan(0);
    expect(verifyActionPacket(packet)).toBe(true);
  });

  it('creates and verifies an observation packet', () => {
    const keypair = generateKeypair();
    const packet = createObservationPacket({
      jobId: 'test-job-1',
      step: 0,
      screenshot: 'base64screenshot',
      domState: 'Title: Test | URL: https://example.com | Links: 3 | Buttons: 1 | Inputs: 0',
      signedBy: keypair.identity.agentId,
    }, keypair);

    expect(packet.signature).toBeTruthy();
    expect(verifyObservationPacket(packet)).toBe(true);
  });

  it('rejects tampered action packet', () => {
    const keypair = generateKeypair();
    const packet = createActionPacket({
      jobId: 'test-job-1',
      step: 0,
      action: 'navigate',
      target: { url: 'https://example.com' },
      signedBy: keypair.identity.agentId,
    }, keypair);

    packet.action = 'click';
    expect(verifyActionPacket(packet)).toBe(false);
  });
});
