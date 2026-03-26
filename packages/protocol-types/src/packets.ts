import { z } from 'zod';
import type { AgentKeypair } from './identity.js';
import { signPayload, verifySignature, fromBase58 } from './identity.js';

export type ActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'screenshot'
  | 'wait'
  | 'key'
  | 'select'
  | 'hover';

export interface ActionTarget {
  x?: number;
  y?: number;
  url?: string;
}

export interface ActionPacket {
  jobId: string;
  step: number;
  action: ActionType;
  target: ActionTarget;
  value?: string;
  signedBy: string;
  signature: string;
  sentAt: number;
}

export interface ObservationPacket {
  jobId: string;
  step: number;
  screenshot: string;
  domState: string;
  signedBy: string;
  signature: string;
  sentAt: number;
}

export const ActionTypeSchema = z.enum([
  'navigate', 'click', 'type', 'scroll', 'screenshot',
  'wait', 'key', 'select', 'hover',
]);

export const ActionTargetSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  url: z.string().optional(),
});

export const ActionPacketSchema = z.object({
  jobId: z.string(),
  step: z.number().int().nonnegative(),
  action: ActionTypeSchema,
  target: ActionTargetSchema,
  value: z.string().optional(),
  signedBy: z.string(),
  signature: z.string(),
  sentAt: z.number(),
});

export const ObservationPacketSchema = z.object({
  jobId: z.string(),
  step: z.number().int().nonnegative(),
  screenshot: z.string(),
  domState: z.string(),
  signedBy: z.string(),
  signature: z.string(),
  sentAt: z.number(),
});

export function createActionPacket(
  params: Omit<ActionPacket, 'signature' | 'sentAt'>,
  keypair: AgentKeypair
): ActionPacket {
  const sentAt = Date.now();
  const toSign = { ...params, sentAt };
  const signed = signPayload(toSign, keypair);

  return {
    ...params,
    signature: signed.signature,
    sentAt,
  };
}

export function createObservationPacket(
  params: Omit<ObservationPacket, 'signature' | 'sentAt'>,
  keypair: AgentKeypair
): ObservationPacket {
  const sentAt = Date.now();
  const toSign = { ...params, sentAt };
  const signed = signPayload(toSign, keypair);

  return {
    ...params,
    signature: signed.signature,
    sentAt,
  };
}

export function verifyActionPacket(packet: ActionPacket): boolean {
  try {
    const { signature, ...rest } = packet;
    const publicKey = fromBase58(packet.signedBy);
    return verifySignature(
      {
        payload: JSON.stringify(rest),
        signature,
        agentId: packet.signedBy,
        signedAt: packet.sentAt,
      },
      publicKey
    );
  } catch {
    return false;
  }
}

export function verifyObservationPacket(packet: ObservationPacket): boolean {
  try {
    const { signature, ...rest } = packet;
    const publicKey = fromBase58(packet.signedBy);
    return verifySignature(
      {
        payload: JSON.stringify(rest),
        signature,
        agentId: packet.signedBy,
        signedAt: packet.sentAt,
      },
      publicKey
    );
  } catch {
    return false;
  }
}
