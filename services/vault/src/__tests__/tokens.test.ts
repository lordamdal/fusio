import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VaultClient } from "../client.js";
import {
  initTokens,
  issueJobToken,
  revokeJobToken,
  getJobToken,
  isTokenValid,
  _resetTokenStore,
} from "../tokens.js";

function createMockClient(): VaultClient {
  return {
    writeSecret: vi.fn().mockResolvedValue(undefined),
    readSecret: vi.fn().mockResolvedValue({ apiKey: "sk-test" }),
    deleteSecret: vi.fn().mockResolvedValue(undefined),
    createToken: vi.fn().mockResolvedValue("hvs.mock-job-token"),
    revokeToken: vi.fn().mockResolvedValue(undefined),
    isHealthy: vi.fn().mockResolvedValue(true),
  };
}

describe("Tokens", () => {
  let mockClient: VaultClient;

  beforeEach(() => {
    mockClient = createMockClient();
    initTokens(mockClient);
    _resetTokenStore();
  });

  describe("issueJobToken", () => {
    it("should copy secrets and create a scoped token", async () => {
      const token = await issueJobToken("job-1", "agent-1", ["openai", "github"], 3600);

      expect(token.jobId).toBe("job-1");
      expect(token.vaultToken).toBe("hvs.mock-job-token");
      expect(token.services).toEqual(["openai", "github"]);
      expect(token.revoked).toBe(false);
      expect(token.expiresAt).toBeGreaterThan(token.issuedAt);

      // Should have read credentials for each service
      expect(mockClient.readSecret).toHaveBeenCalledWith("agents/agent-1/openai");
      expect(mockClient.readSecret).toHaveBeenCalledWith("agents/agent-1/github");

      // Should have written job-scoped secrets
      expect(mockClient.writeSecret).toHaveBeenCalledWith("jobs/job-1/openai", { apiKey: "sk-test" });
      expect(mockClient.writeSecret).toHaveBeenCalledWith("jobs/job-1/github", { apiKey: "sk-test" });

      // Should have created a Vault token
      expect(mockClient.createToken).toHaveBeenCalledWith(
        ["worker"],
        { jobId: "job-1", agentId: "agent-1" },
        3600,
      );
    });
  });

  describe("revokeJobToken", () => {
    it("should revoke token and delete job-scoped secrets", async () => {
      await issueJobToken("job-2", "agent-1", ["openai"], 3600);
      await revokeJobToken("job-2");

      expect(mockClient.revokeToken).toHaveBeenCalledWith("hvs.mock-job-token");
      expect(mockClient.deleteSecret).toHaveBeenCalledWith("jobs/job-2/openai");

      const token = getJobToken("job-2");
      expect(token?.revoked).toBe(true);
    });

    it("should be a no-op for unknown jobId", async () => {
      await revokeJobToken("nonexistent");
      expect(mockClient.revokeToken).not.toHaveBeenCalled();
    });
  });

  describe("getJobToken", () => {
    it("should return the token for a known jobId", async () => {
      await issueJobToken("job-3", "agent-1", ["openai"], 3600);
      const token = getJobToken("job-3");
      expect(token).toBeDefined();
      expect(token!.jobId).toBe("job-3");
    });

    it("should return undefined for unknown jobId", () => {
      expect(getJobToken("unknown")).toBeUndefined();
    });
  });

  describe("isTokenValid", () => {
    it("should return true for a valid non-expired token", async () => {
      const token = await issueJobToken("job-4", "agent-1", ["openai"], 3600);
      expect(isTokenValid(token)).toBe(true);
    });

    it("should return false for a revoked token", async () => {
      const token = await issueJobToken("job-5", "agent-1", ["openai"], 3600);
      await revokeJobToken("job-5");
      const updated = getJobToken("job-5")!;
      expect(isTokenValid(updated)).toBe(false);
    });

    it("should return false for an expired token", () => {
      const expired = {
        jobId: "expired",
        vaultToken: "hvs.old",
        issuedAt: Date.now() - 7200_000,
        expiresAt: Date.now() - 3600_000,
        services: [],
        revoked: false,
      };
      expect(isTokenValid(expired)).toBe(false);
    });
  });
});
