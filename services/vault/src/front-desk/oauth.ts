import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import { pino } from "pino";
import type { VaultClient } from "../client.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info", name: "oauth" });

interface PendingOAuth {
  state: string;
  codeVerifier: string;
  agentId: string;
  service: string;
  createdAt: number;
}

const pendingFlows = new Map<string, PendingOAuth>();

export function registerOAuthRoutes(app: FastifyInstance, client: VaultClient): void {
  // Start OAuth PKCE flow
  app.post("/credentials/oauth/start", async (req, reply) => {
    const { agentId, service } = req.body as { agentId?: string; service?: string };
    if (!agentId || !service) {
      return reply.status(400).send({ error: "agentId and service are required" });
    }

    const state = uuidv4();
    const codeVerifier = uuidv4() + uuidv4(); // simplified PKCE verifier

    pendingFlows.set(state, {
      state,
      codeVerifier,
      agentId,
      service,
      createdAt: Date.now(),
    });

    // In a real implementation this would redirect to the OAuth provider
    const clientId = process.env.GOOGLE_CLIENT_ID || "mock-client-id";
    const redirectUri = process.env.OAUTH_REDIRECT_URI || "http://localhost:8201/credentials/oauth/callback";

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent("openid email")}` +
      `&state=${state}` +
      `&code_challenge=${state}` + // simplified; real impl uses S256
      `&code_challenge_method=plain`;

    logger.info({ agentId, service, state }, "OAuth PKCE flow started");

    return reply.send({
      authUrl,
      state,
      message: "Redirect user to authUrl to begin OAuth flow",
    });
  });

  // OAuth callback handler
  app.get("/credentials/oauth/callback", async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) {
      return reply.status(400).send({ error: "code and state are required" });
    }

    const pending = pendingFlows.get(state);
    if (!pending) {
      return reply.status(400).send({ error: "Unknown or expired state" });
    }

    pendingFlows.delete(state);

    // In production, exchange code for tokens via the provider's token endpoint.
    // For local dev/test, use mock tokens.
    const mockTokens = {
      access_token: `mock-access-${uuidv4()}`,
      refresh_token: `mock-refresh-${uuidv4()}`,
      expires_in: "3600",
    };

    logger.info({ agentId: pending.agentId, service: pending.service }, "OAuth callback - storing tokens");

    await client.writeSecret(`agents/${pending.agentId}/${pending.service}`, mockTokens);

    return reply.send({
      success: true,
      agentId: pending.agentId,
      service: pending.service,
      message: "OAuth credentials stored",
    });
  });
}
