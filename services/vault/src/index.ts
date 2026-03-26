import { pino } from "pino";
import { createVaultClient } from "./client.js";
import { initTokens, issueJobToken, revokeJobToken, getJobToken } from "./tokens.js";
import { buildFrontDesk } from "./front-desk/index.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", name: "vault-service" });

const VAULT_ADDR = process.env.VAULT_ADDR ?? "http://localhost:8200";
const VAULT_ROOT_TOKEN = process.env.VAULT_ROOT_TOKEN ?? "fusio-local-dev-token";
const FRONT_DESK_PORT = parseInt(process.env.FRONT_DESK_PORT ?? "8201", 10);

const client = createVaultClient(VAULT_ADDR, VAULT_ROOT_TOKEN);
initTokens(client);

async function waitForVault(maxRetries: number = 10): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    const healthy = await client.isHealthy();
    if (healthy) {
      logger.info("[VAULT-CLIENT] Vault is healthy");
      return;
    }
    logger.warn(`[VAULT-CLIENT] Vault not ready, retry ${i}/${maxRetries}...`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  logger.warn("[VAULT-CLIENT] Vault not reachable after retries - starting anyway");
}

async function main(): Promise<void> {
  await waitForVault();

  const app = await buildFrontDesk(client);

  await app.listen({ port: FRONT_DESK_PORT, host: "0.0.0.0" });
  logger.info(`[VAULT-CLIENT] Front desk ready on port ${FRONT_DESK_PORT} — Vault at ${VAULT_ADDR}`);
}

main().catch((err) => {
  logger.fatal(err, "Failed to start vault service");
  process.exit(1);
});

export { issueJobToken, revokeJobToken, getJobToken };
