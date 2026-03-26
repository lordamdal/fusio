import type { FastifyInstance } from "fastify";
import type { VaultClient } from "./client.js";

const startTime = Date.now();

export function registerHealthRoute(app: FastifyInstance, client: VaultClient): void {
  app.get("/health", async (_req, reply) => {
    const vaultConnected = await client.isHealthy();
    const status = vaultConnected ? "ok" : "degraded";
    return reply.status(vaultConnected ? 200 : 503).send({
      status,
      service: "vault",
      vaultConnected,
      uptimeMs: Date.now() - startTime,
    });
  });
}
