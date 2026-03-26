import Fastify from "fastify";
import { pino } from "pino";
import type { VaultClient } from "../client.js";
import { validateApiKey } from "./apikey.js";
import { registerOAuthRoutes } from "./oauth.js";
import { registerWebSessionRoutes } from "./web-session.js";
import { registerHealthRoute } from "../health.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", name: "front-desk" });

export async function buildFrontDesk(client: VaultClient) {
  const app = Fastify({ logger: false });

  // Health
  registerHealthRoute(app, client);

  // OAuth routes
  registerOAuthRoutes(app, client);

  // Web session routes (browser login proxy)
  registerWebSessionRoutes(app, client);

  // POST /credentials/apikey - Store API key after validation
  app.post("/credentials/apikey", async (req, reply) => {
    const { agentId, service, apiKey } = req.body as {
      agentId?: string;
      service?: string;
      apiKey?: string;
    };

    if (!agentId || !service || !apiKey) {
      return reply.status(400).send({ error: "agentId, service, and apiKey are required" });
    }

    const result = await validateApiKey(service, apiKey);
    if (!result.valid) {
      return reply.status(422).send({ error: result.message });
    }

    await client.writeSecret(`agents/${agentId}/${service}`, {
      apiKey,
      service,
      storedAt: new Date().toISOString(),
    });

    logger.info({ agentId, service }, "API key stored");
    return reply.status(201).send({
      success: true,
      agentId,
      service,
      message: result.message,
    });
  });

  // GET /credentials/list/:agentId - List services with stored credentials
  app.get("/credentials/list/:agentId", async (req, reply) => {
    const { agentId } = req.params as { agentId: string };

    // Vault KV v2 does not have a simple list-by-prefix for data,
    // so we maintain a registry of stored services per agent.
    const registry = await client.readSecret(`agents/${agentId}/_registry`);
    const services = registry ? Object.keys(registry).filter((k) => k !== "_updated") : [];

    return reply.send({ agentId, services });
  });

  // DELETE /credentials/:agentId/:service - Remove credentials
  app.delete("/credentials/:agentId/:service", async (req, reply) => {
    const { agentId, service } = req.params as { agentId: string; service: string };

    await client.deleteSecret(`agents/${agentId}/${service}`);

    // Update registry
    const registry = await client.readSecret(`agents/${agentId}/_registry`);
    if (registry && registry[service]) {
      delete registry[service];
      registry._updated = new Date().toISOString();
      await client.writeSecret(`agents/${agentId}/_registry`, registry);
    }

    logger.info({ agentId, service }, "Credentials deleted");
    return reply.send({ success: true, agentId, service });
  });

  // Hook: update registry on apikey store
  app.addHook("onResponse", async (req) => {
    if (req.method === "POST" && req.url === "/credentials/apikey" && req.raw.statusCode === 201) {
      try {
        const { agentId, service } = req.body as { agentId: string; service: string };
        const registry = (await client.readSecret(`agents/${agentId}/_registry`)) ?? {};
        registry[service] = new Date().toISOString();
        registry._updated = new Date().toISOString();
        await client.writeSecret(`agents/${agentId}/_registry`, registry);
      } catch {
        // best-effort
      }
    }
  });

  return app;
}
