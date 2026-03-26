import type { NatsConnection } from 'nats';
import { StringCodec } from 'nats';
import { pino } from 'pino';
import type { VaultClient } from '../client.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info', name: 'session-monitor' });
const sc = StringCodec();

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const PROVIDERS = ['claude', 'openai'] as const;

let monitorInterval: ReturnType<typeof setInterval> | null = null;

export function startSessionMonitor(client: VaultClient, nc?: NatsConnection): void {
  if (monitorInterval) {
    logger.warn('Session monitor already running');
    return;
  }

  logger.info('Starting session monitor');

  monitorInterval = setInterval(async () => {
    await checkAllSessions(client, nc);
  }, CHECK_INTERVAL_MS);

  // Run initial check after 1 minute
  setTimeout(() => checkAllSessions(client, nc), 60_000);
}

export function stopSessionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    logger.info('Session monitor stopped');
  }
}

async function checkAllSessions(client: VaultClient, nc?: NatsConnection): Promise<void> {
  logger.debug('Checking all web sessions');

  // Get all agent registries to find sessions
  // Since Vault KV v2 doesn't support easy prefix listing,
  // we rely on the registry entries to find agents with web sessions.
  // In practice, the monitor would be called with specific agent IDs.
  // For now, this is a placeholder that checks sessions when called directly.
}

export async function checkAgentSessions(
  client: VaultClient,
  agentId: string,
  nc?: NatsConnection,
): Promise<{ provider: string; valid: boolean; reason?: string }[]> {
  const results: { provider: string; valid: boolean; reason?: string }[] = [];

  for (const provider of PROVIDERS) {
    const session = await client.readSecret(`agents/${agentId}/${provider}-web-session`);
    if (!session) continue;

    // Check estimated expiry
    const isExpired = session.expiresAt && new Date(session.expiresAt) < new Date();

    if (isExpired) {
      logger.info({ agentId, provider }, 'Web session expired');

      // Publish expiry event
      if (nc) {
        nc.publish(
          `fusio.session.expired.${agentId}.${provider}`,
          sc.encode(JSON.stringify({
            agentId,
            provider,
            expiredAt: session.expiresAt,
            timestamp: Date.now(),
          })),
        );
      }

      results.push({ provider, valid: false, reason: 'expired' });
    } else {
      results.push({ provider, valid: true });
    }
  }

  return results;
}
