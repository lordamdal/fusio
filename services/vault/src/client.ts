import { pino } from "pino";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", name: "vault-client" });

export interface VaultClient {
  writeSecret(path: string, data: Record<string, string>): Promise<void>;
  readSecret(path: string): Promise<Record<string, string> | null>;
  deleteSecret(path: string): Promise<void>;
  createToken(
    policies: string[],
    metadata: Record<string, string>,
    ttlSeconds: number,
  ): Promise<string>;
  revokeToken(token: string): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export function createVaultClient(vaultAddr: string, rootToken: string): VaultClient {
  const baseUrl = vaultAddr.replace(/\/+$/, "");

  async function vaultFetch(
    path: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const url = `${baseUrl}${path}`;
    logger.debug({ url, method: options.method ?? "GET" }, "vault request");
    const res = await fetch(url, {
      ...options,
      headers: {
        "X-Vault-Token": rootToken,
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`Vault ${options.method ?? "GET"} ${path} failed: ${res.status} ${body}`);
      (err as any).status = res.status;
      throw err;
    }
    return res;
  }

  return {
    async writeSecret(path: string, data: Record<string, string>): Promise<void> {
      logger.debug({ path }, "writeSecret");
      await vaultFetch(`/v1/fusio-secrets/data/${path}`, {
        method: "POST",
        body: JSON.stringify({ data }),
      });
    },

    async readSecret(path: string): Promise<Record<string, string> | null> {
      logger.debug({ path }, "readSecret");
      try {
        const res = await vaultFetch(`/v1/fusio-secrets/data/${path}`, {
          method: "GET",
        });
        const json = (await res.json()) as any;
        return (json?.data?.data as Record<string, string>) ?? null;
      } catch (err: any) {
        if (err.status === 404) return null;
        throw err;
      }
    },

    async deleteSecret(path: string): Promise<void> {
      logger.debug({ path }, "deleteSecret");
      await vaultFetch(`/v1/fusio-secrets/metadata/${path}`, {
        method: "DELETE",
      });
    },

    async createToken(
      policies: string[],
      metadata: Record<string, string>,
      ttlSeconds: number,
    ): Promise<string> {
      logger.debug({ policies, ttlSeconds }, "createToken");
      const res = await vaultFetch("/v1/auth/token/create", {
        method: "POST",
        body: JSON.stringify({
          policies,
          meta: metadata,
          ttl: `${ttlSeconds}s`,
          renewable: false,
        }),
      });
      const json = (await res.json()) as any;
      return json.auth.client_token as string;
    },

    async revokeToken(token: string): Promise<void> {
      logger.debug("revokeToken");
      await vaultFetch("/v1/auth/token/revoke", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
    },

    async isHealthy(): Promise<boolean> {
      try {
        const res = await fetch(`${baseUrl}/v1/sys/health`, {
          headers: { "X-Vault-Token": rootToken },
        });
        return res.ok;
      } catch {
        return false;
      }
    },
  };
}
