import { describe, it, expect, vi, beforeEach } from "vitest";
import { createVaultClient } from "../client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("VaultClient", () => {
  const client = createVaultClient("http://localhost:8200", "test-token");

  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("writeSecret", () => {
    it("should POST data to the KV v2 data endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await client.writeSecret("agents/a1/openai", { apiKey: "sk-123" });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8200/v1/fusio-secrets/data/agents/a1/openai",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ data: { apiKey: "sk-123" } }),
        }),
      );
    });

    it("should throw on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "internal error",
      });

      await expect(client.writeSecret("test", { key: "val" })).rejects.toThrow("500");
    });
  });

  describe("readSecret", () => {
    it("should return parsed data from KV v2", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { data: { apiKey: "sk-123" } } }),
      });

      const result = await client.readSecret("agents/a1/openai");
      expect(result).toEqual({ apiKey: "sk-123" });
    });

    it("should return null on 404", async () => {
      const err = new Error("Vault GET /v1/fusio-secrets/data/missing failed: 404 ");
      (err as any).status = 404;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "",
      });

      const result = await client.readSecret("missing");
      expect(result).toBeNull();
    });
  });

  describe("createToken", () => {
    it("should POST to auth/token/create and return client_token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ auth: { client_token: "hvs.new-token" } }),
      });

      const token = await client.createToken(["worker"], { jobId: "j1" }, 3600);
      expect(token).toBe("hvs.new-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8200/v1/auth/token/create",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("revokeToken", () => {
    it("should POST to auth/token/revoke", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await client.revokeToken("hvs.old-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:8200/v1/auth/token/revoke",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "hvs.old-token" }),
        }),
      );
    });
  });

  describe("isHealthy", () => {
    it("should return true when Vault is healthy", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await client.isHealthy();
      expect(result).toBe(true);
    });

    it("should return false when fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
      const result = await client.isHealthy();
      expect(result).toBe(false);
    });
  });
});
