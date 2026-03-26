import { createHash } from 'node:crypto';
import {
  type JobManifest,
  type AgentKeypair,
  type CompletionReceipt,
  createReceipt,
  signReceiptAsWorker,
  bytesToHex,
} from '@fusio/protocol-types';
import { pino } from 'pino';

const logger = pino({ name: 'worker-receipt' });

export async function buildAndSign(
  jobId: string,
  manifest: JobManifest,
  stats: { startedAt: number; actionCount: number; wipeHash: string },
  workerKeypair: AgentKeypair
): Promise<CompletionReceipt> {
  const completedAt = Date.now();
  const workerIdHash = createHash('sha256')
    .update(bytesToHex(workerKeypair.identity.publicKey))
    .digest('hex');
  const jobHash = createHash('sha256')
    .update(JSON.stringify(manifest))
    .digest('hex');

  const baseReceipt = createReceipt({
    jobId,
    agentId: manifest.agentId,
    workerIdHash,
    jobHash,
    startedAt: stats.startedAt,
    completedAt,
    actionCount: stats.actionCount,
    outcome: 'completed',
    faultClass: 'none',
    costAgr: manifest.maxPriceAgr,
    wipeHash: stats.wipeHash,
  });

  const receipt: CompletionReceipt = {
    ...baseReceipt,
    agentSignature: 'PENDING_ORCHESTRATOR_SIGN',
    workerSignature: '',
  };

  const signed = signReceiptAsWorker(receipt, workerKeypair);

  logger.info({
    receiptId: signed.receiptId,
    jobId,
    actionCount: stats.actionCount,
    outcome: 'completed',
  }, 'Receipt built and signed');

  return signed;
}
