import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { VaultClient } from "../client.js";
import { buildFrontDesk } from "../front-desk/index.js";
import type { FastifyInstance } from "fastify";

// Mock the apikey validator so we don't make real HTTP calls
vi.mock("../front-desk/apikey.js", () => ({
  validateApiKey: vi.fn().mockResolvedValue({ valid: true, message: "Key accepted (mock)" }),
}));

function createMockClient(): VaultClient {
  const store = new Map<string, Record<string, string>>();
  return {
    writeSecret: vi.fn(async (path: string, data: Record<string, string>) => {
      store.set(path, data);
    }),
    readSecret: vi.fn(async (path: string) => {
      return store.get(path) ?? null;
    }),
    deleteSecret: vi.fn(async (path: string) => {
      store.delete(path);
    }),
    createToken: vi.fn().mockResolvedValue("hvs.mock-token"),
    revokeToken: vi.fn().mockResolvedValue(undefined),
    isHealthy: vi.fn().mockResolvedValue(true),
  };
}

describe("Front Desk API", () => {
  let app: FastifyInstance;
  let mockClient: VaultClient;

  beforeAll(async () => {
    mockClient = createMockClient();
    app = await buildFrontDesk(mockClient);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.status).toBe("ok");
      expect(body.service).toBe("vault");
      expect(body.vaultConnected).toBe(true);
      expect(typeof body.uptimeMs).toBe("number");
    });
  });

  describe("POST /credentials/apikey", () => {
    it("should store a valid API key", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/credentials/apikey",
        payload: {
          agentId: "agent-1",
          service: "openai",
          apiKey: "sk-test-key",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.service).toBe("openai");

      expect(mockClient.writeSecret).toHaveBeenCalledWith(
        "agents/agent-1/openai",
        expect.objectContaining({ apiKey: "sk-test-key", service: "openai" }),
      );
    });

    it("should reject when missing fields", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/credentials/apikey",
        payload: { agentId: "agent-1" },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /credentials/list/:agentId", () => {
    it("should list services from registry", async () => {
      // Pre-populate registry
      await mockClient.writeSecret("agents/agent-2/_registry", {
        openai: "2024-01-01T00:00:00Z",
        github: "2024-01-01T00:00:00Z",
        _updated: "2024-01-01T00:00:00Z",
      });

      const res = await app.inject({
        method: "GET",
        url: "/credentials/list/agent-2",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.agentId).toBe("agent-2");
      expect(body.services).toContain("openai");
      expect(body.services).toContain("github");
      expect(body.services).not.toContain("_updated");
    });

    it("should return empty for unknown agent", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/credentials/list/unknown",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.services).toEqual([]);
    });
  });

  describe("DELETE /credentials/:agentId/:service", () => {
    it("should delete credentials", async () => {
      // Store something first
      await mockClient.writeSecret("agents/agent-3/slack", { token: "xoxb-123" });

      const res = await app.inject({
        method: "DELETE",
        url: "/credentials/agent-3/slack",
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(mockClient.deleteSecret).toHaveBeenCalledWith("agents/agent-3/slack");
    });
  });
});
