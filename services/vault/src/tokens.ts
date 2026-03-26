import type { VaultClient } from "./client.js";

export interface ScopedToken {
  jobId: string;
  vaultToken: string;
  issuedAt: number;
  expiresAt: number;
  services: string[];
  revoked: boolean;
}

const tokenStore = new Map<string, ScopedToken>();

let _client: VaultClient;

export function initTokens(client: VaultClient): void {
  _client = client;
}

export async function issueJobToken(
  jobId: string,
  agentId: string,
  requiredServices: string[],
  ttlSeconds: number = 3600,
): Promise<ScopedToken> {
  const client = _client;
  if (!client) throw new Error("Token module not initialized: call initTokens first");

  // Copy agent credentials to job-scoped path
  // Include both API keys and web sessions
  const webSessionSuffixes = ['-web-session'];
  for (const service of requiredServices) {
    const creds = await client.readSecret(`agents/${agentId}/${service}`);
    if (creds) {
      await client.writeSecret(`jobs/${jobId}/${service}`, creds);
    }
    // Also check for web session credentials for this provider
    for (const suffix of webSessionSuffixes) {
      const webCreds = await client.readSecret(`agents/${agentId}/${service}${suffix}`);
      if (webCreds) {
        await client.writeSecret(`jobs/${jobId}/${service}${suffix}`, webCreds);
      }
    }
  }

  // Create a Vault token scoped to the job
  const vaultToken = await client.createToken(
    ["worker"],
    { jobId, agentId },
    ttlSeconds,
  );

  const now = Date.now();
  const scoped: ScopedToken = {
    jobId,
    vaultToken,
    issuedAt: now,
    expiresAt: now + ttlSeconds * 1000,
    services: requiredServices,
    revoked: false,
  };

  tokenStore.set(jobId, scoped);
  return scoped;
}

export async function revokeJobToken(jobId: string): Promise<void> {
  const client = _client;
  if (!client) throw new Error("Token module not initialized: call initTokens first");

  const scoped = tokenStore.get(jobId);
  if (!scoped) return;

  // Revoke the Vault token
  await client.revokeToken(scoped.vaultToken);

  // Delete job-scoped secrets
  for (const service of scoped.services) {
    await client.deleteSecret(`jobs/${jobId}/${service}`).catch(() => {});
  }

  scoped.revoked = true;
  tokenStore.set(jobId, scoped);
}

export function getJobToken(jobId: string): ScopedToken | undefined {
  return tokenStore.get(jobId);
}

export function isTokenValid(token: ScopedToken): boolean {
  if (token.revoked) return false;
  if (Date.now() > token.expiresAt) return false;
  return true;
}

/** Reset internal store (for testing) */
export function _resetTokenStore(): void {
  tokenStore.clear();
}
