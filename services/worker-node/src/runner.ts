import type { NatsConnection, Subscription } from 'nats';
import { StringCodec } from 'nats';
import type { Page, Browser } from 'playwright';
import {
  type JobManifest,
  type ActionPacket,
  type AgentKeypair,
  verifyActionPacket,
  createObservationPacket,
  MAX_STEPS_PER_JOB,
} from '@fusio/protocol-types';
import { SUBJECTS } from './messaging/subjects.js';
import * as container from './browser/container.js';
import { connectBrowser, captureScreenshot, captureDomSummary, disconnectBrowser } from './browser/playwright.js';
import { execute } from './browser/actions.js';
import { buildAndSign } from './receipt.js';
import { completeLLM, type CredentialSet, type LLMRequest, type LLMResponse, SessionExpiredError } from './llm/interface.js';
import { closeProxyBrowser } from './llm/web-proxy.js';
import { pino } from 'pino';

const logger = pino({ name: 'worker-runner' });
const sc = StringCodec();

export interface RunnerState {
  activeJobId: string | null;
  currentStep: number;
  credentials: CredentialSet | null;
}

export { completeLLM, type LLMRequest, type LLMResponse };

export const state: RunnerState = {
  activeJobId: null,
  currentStep: 0,
  credentials: null,
};

export async function handleJob(
  manifest: JobManifest,
  nc: NatsConnection,
  workerKeypair: AgentKeypair
): Promise<void> {
  const { jobId } = manifest;
  state.activeJobId = jobId;
  state.currentStep = 0;

  logger.info({ jobId, purpose: manifest.declaredPurpose }, 'Job received');

  let browser: Browser | null = null;
  let actionSub: Subscription | null = null;
  let cancelSub: Subscription | null = null;
  const startedAt = Date.now();
  let actionCount = 0;
  let cancelled = false;

  try {
    // Start Docker container
    const session = await container.start(jobId);

    // Connect Playwright
    const conn = await connectBrowser(session.wsEndpoint);
    browser = conn.browser;
    const page = conn.page;

    // Subscribe to cancel
    cancelSub = nc.subscribe(SUBJECTS.JOB_CANCEL(jobId));
    (async () => {
      for await (const _msg of cancelSub) {
        logger.warn({ jobId }, 'Job cancelled by orchestrator');
        cancelled = true;
      }
    })();

    // Subscribe to action packets
    actionSub = nc.subscribe(SUBJECTS.ACTION_PACKET(jobId));

    for await (const msg of actionSub) {
      if (cancelled) break;
      if (actionCount >= MAX_STEPS_PER_JOB) {
        logger.warn({ jobId, actionCount }, 'Max steps reached');
        break;
      }

      const packet: ActionPacket = JSON.parse(sc.decode(msg.data));

      // Verify packet signature
      if (!verifyActionPacket(packet)) {
        logger.warn({ jobId, step: packet.step }, 'Invalid action packet signature, skipping');
        continue;
      }

      // Execute action
      await execute(packet, page);
      actionCount++;
      state.currentStep = packet.step;

      // Capture observation
      const screenshot = await captureScreenshot(page);
      const domState = await captureDomSummary(page);

      const observation = createObservationPacket({
        jobId,
        step: packet.step,
        screenshot,
        domState,
        signedBy: workerKeypair.identity.agentId,
      }, workerKeypair);

      nc.publish(SUBJECTS.OBSERVATION(jobId), sc.encode(JSON.stringify(observation)));
    }

    // Build and sign receipt
    const wipeHash = await container.stop(jobId);
    const receipt = await buildAndSign(jobId, manifest, { startedAt, actionCount, wipeHash }, workerKeypair);

    nc.publish(SUBJECTS.JOB_COMPLETE(jobId), sc.encode(JSON.stringify(receipt)));

    logger.info({ jobId, actionCount, outcome: 'completed' }, 'Job complete');
  } catch (err) {
    const error = err as Error;
    const faultClass = error instanceof SessionExpiredError ? 'session_expired' : 'worker_fault';
    logger.error({ jobId, err: error.message, stack: error.stack, faultClass }, 'Job failed');

    // Notify desktop app if session expired so user can re-login
    if (error instanceof SessionExpiredError) {
      nc.publish(
        `fusio.session.expired.${manifest.agentId}`,
        sc.encode(JSON.stringify({ jobId, error: error.message, timestamp: Date.now() }))
      );
    }

    nc.publish(
      SUBJECTS.JOB_FAILED(jobId),
      sc.encode(JSON.stringify({
        jobId,
        error: error.message,
        faultClass,
        timestamp: Date.now(),
      }))
    );

    try {
      await container.stop(jobId);
    } catch {
      // Container may already be stopped
    }
  } finally {
    if (browser) await disconnectBrowser(browser);
    if (actionSub) actionSub.unsubscribe();
    if (cancelSub) cancelSub.unsubscribe();
    await closeProxyBrowser();
    state.activeJobId = null;
    state.currentStep = 0;
    state.credentials = null;
  }
}
