import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { AgentKeypair } from './identity.js';
import { signPayload, verifySignature, fromBase58 } from './identity.js';

export type JobOutcome = 'completed' | 'failed' | 'aborted' | 'migrated';

export type FaultClass =
  | 'worker_fault'
  | 'requester_fault'
  | 'external_fault'
  | 'environmental_fault'
  | 'credential_fault'
  | 'none';

export interface CompletionReceipt {
  receiptId: string;
  jobId: string;
  agentId: string;
  workerIdHash: string;
  jobHash: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  actionCount: number;
  outcome: JobOutcome;
  faultClass: FaultClass;
  costAgr: number;
  wipeHash: string;
  agentSignature: string;
  workerSignature: string;
}

export const JobOutcomeSchema = z.enum(['completed', 'failed', 'aborted', 'migrated']);
export const FaultClassSchema = z.enum([
  'worker_fault', 'requester_fault', 'external_fault',
  'environmental_fault', 'credential_fault', 'none',
]);

export const CompletionReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  jobId: z.string(),
  agentId: z.string(),
  workerIdHash: z.string(),
  jobHash: z.string(),
  startedAt: z.number(),
  completedAt: z.number(),
  durationMs: z.number().nonnegative(),
  actionCount: z.number().int().nonnegative(),
  outcome: JobOutcomeSchema,
  faultClass: FaultClassSchema,
  costAgr: z.number().nonnegative(),
  wipeHash: z.string(),
  agentSignature: z.string(),
  workerSignature: z.string(),
});

export function createReceipt(
  params: Omit<CompletionReceipt, 'receiptId' | 'durationMs' | 'agentSignature' | 'workerSignature'>
): Omit<CompletionReceipt, 'agentSignature' | 'workerSignature'> {
  return {
    receiptId: uuidv4(),
    ...params,
    durationMs: params.completedAt - params.startedAt,
  };
}

export function signReceiptAsAgent(
  receipt: CompletionReceipt,
  keypair: AgentKeypair
): CompletionReceipt {
  const { agentSignature, workerSignature, ...receiptData } = receipt;
  const signed = signPayload(receiptData, keypair);
  return { ...receipt, agentSignature: signed.signature };
}

export function signReceiptAsWorker(
  receipt: CompletionReceipt,
  keypair: AgentKeypair
): CompletionReceipt {
  const { agentSignature, workerSignature, ...receiptData } = receipt;
  const signed = signPayload(receiptData, keypair);
  return { ...receipt, workerSignature: signed.signature };
}

export function verifyReceipt(
  receipt: CompletionReceipt,
  agentPublicKey: Uint8Array,
  workerPublicKey: Uint8Array
): boolean {
  const { agentSignature, workerSignature, ...receiptData } = receipt;

  const agentValid = verifySignature(
    {
      payload: JSON.stringify(receiptData),
      signature: agentSignature,
      agentId: receipt.agentId,
      signedAt: receipt.completedAt,
    },
    agentPublicKey
  );

  const workerValid = verifySignature(
    {
      payload: JSON.stringify(receiptData),
      signature: workerSignature,
      agentId: receipt.workerIdHash,
      signedAt: receipt.completedAt,
    },
    workerPublicKey
  );

  return agentValid && workerValid;
}
