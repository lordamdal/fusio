import type { FastifyInstance } from "fastify";
import { pino } from "pino";
import type { VaultClient } from "../client.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", name: "web-session" });

export interface WebSessionCredential {
  provider: "claude" | "openai";
  cookies: string;       // JSON-serialized cookie array
  localStorage: string;  // JSON-serialized key-value pairs
  userAgent: string;
  capturedAt: string;    // ISO timestamp
  expiresAt: string;     // estimated expiry
}

const VALID_PROVIDERS = ["claude", "openai"] as const;

function isValidProvider(p: string): p is "claude" | "openai" {
  return (VALID_PROVIDERS as readonly string[]).includes(p);
}

export function registerWebSessionRoutes(app: FastifyInstance, client: VaultClient): void {
  // POST /credentials/web-session — store a captured browser session
  app.post("/credentials/web-session", async (req, reply) => {
    const { agentId, provider, cookies, localStorage, userAgent } = req.body as {
      agentId?: string;
      provider?: string;
      cookies?: string;
      localStorage?: string;
      userAgent?: string;
    };

    if (!agentId || !provider || !cookies) {
      return reply.status(400).send({ error: "agentId, provider, and cookies are required" });
    }

    if (!isValidProvider(provider)) {
      return reply.status(400).send({ error: `Invalid provider: ${provider}. Must be 'claude' or 'openai'` });
    }

    // Validate that cookies is valid JSON
    try {
      JSON.parse(cookies);
    } catch {
      return reply.status(400).send({ error: "cookies must be a valid JSON string" });
    }

    const now = new Date();
    // Estimate session expiry: Claude ~14 days, OpenAI ~30 days
    const expiryDays = provider === "claude" ? 14 : 30;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);

    const sessionPath = `agents/${agentId}/${provider}-web-session`;

    await client.writeSecret(sessionPath, {
      provider,
      cookies,
      localStorage: localStorage ?? "{}",
      userAgent: userAgent ?? "",
      capturedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    // Update registry
    try {
      const registry = (await client.readSecret(`agents/${agentId}/_registry`)) ?? {};
      registry[`${provider}-web-session`] = now.toISOString();
      registry._updated = now.toISOString();
      await client.writeSecret(`agents/${agentId}/_registry`, registry);
    } catch {
      // best-effort
    }

    logger.info({ agentId, provider }, "Web session stored");
    return reply.status(201).send({
      success: true,
      agentId,
      provider,
      expiresAt: expiresAt.toISOString(),
      message: `${provider} web session stored successfully`,
    });
  });

  // GET /credentials/web-session/:agentId/:provider — retrieve session
  app.get("/credentials/web-session/:agentId/:provider", async (req, reply) => {
    const { agentId, provider } = req.params as { agentId: string; provider: string };

    if (!isValidProvider(provider)) {
      return reply.status(400).send({ error: `Invalid provider: ${provider}` });
    }

    const session = await client.readSecret(`agents/${agentId}/${provider}-web-session`);
    if (!session) {
      return reply.status(404).send({ error: `No web session found for ${provider}` });
    }

    // Check if session has expired (estimated)
    const isExpired = session.expiresAt && new Date(session.expiresAt) < new Date();

    return reply.send({
      agentId,
      provider,
      session: {
        ...session,
        isExpired,
      },
    });
  });

  // POST /credentials/web-session/validate — check if a stored session is still valid
  app.post("/credentials/web-session/validate", async (req, reply) => {
    const { agentId, provider } = req.body as { agentId?: string; provider?: string };

    if (!agentId || !provider) {
      return reply.status(400).send({ error: "agentId and provider are required" });
    }

    if (!isValidProvider(provider)) {
      return reply.status(400).send({ error: `Invalid provider: ${provider}` });
    }

    const session = await client.readSecret(`agents/${agentId}/${provider}-web-session`);
    if (!session) {
      return reply.send({ valid: false, reason: "no_session" });
    }

    // Check estimated expiry
    const isExpired = session.expiresAt && new Date(session.expiresAt) < new Date();
    if (isExpired) {
      return reply.send({ valid: false, reason: "expired" });
    }

    // For full validation, a Playwright session check would be needed.
    // That's handled by the session-monitor service, not this endpoint.
    return reply.send({ valid: true, expiresAt: session.expiresAt });
  });

  // DELETE /credentials/web-session/:agentId/:provider — remove session
  app.delete("/credentials/web-session/:agentId/:provider", async (req, reply) => {
    const { agentId, provider } = req.params as { agentId: string; provider: string };

    if (!isValidProvider(provider)) {
      return reply.status(400).send({ error: `Invalid provider: ${provider}` });
    }

    await client.deleteSecret(`agents/${agentId}/${provider}-web-session`);

    // Update registry
    try {
      const registry = await client.readSecret(`agents/${agentId}/_registry`);
      if (registry && registry[`${provider}-web-session`]) {
        delete registry[`${provider}-web-session`];
        registry._updated = new Date().toISOString();
        await client.writeSecret(`agents/${agentId}/_registry`, registry);
      }
    } catch {
      // best-effort
    }

    logger.info({ agentId, provider }, "Web session deleted");
    return reply.send({ success: true, agentId, provider });
  });
}
