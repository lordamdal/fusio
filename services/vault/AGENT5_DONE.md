# Agent 5 - Vault / Credentials Service

## Status: COMPLETE

## Summary

Built the `@fusio/vault` service at `services/vault/` providing:

1. **Vault Client** (`src/client.ts`) - Thin HTTP client for HashiCorp Vault KV v2, using native `fetch`. Supports read/write/delete secrets, create/revoke tokens, and health checks.

2. **Scoped Token Lifecycle** (`src/tokens.ts`) - Issues job-scoped Vault tokens that copy agent credentials to a job path, creates a time-limited Vault token with worker policy, and supports revocation with cleanup.

3. **Front Desk HTTP API** (`src/front-desk/`) - Fastify server exposing:
   - `POST /credentials/apikey` - Store API keys with service-specific validation (OpenAI, Anthropic, generic)
   - `POST /credentials/oauth/start` - Start OAuth PKCE flow
   - `GET /credentials/oauth/callback` - Handle OAuth callback
   - `GET /credentials/list/:agentId` - List stored credential services
   - `DELETE /credentials/:agentId/:service` - Remove credentials
   - `GET /health` - Service health check

4. **Vault Config** (`vault-config/`) - Bootstrap script, orchestrator and worker HCL policies for dev Vault server.

## Build & Test

- **Build**: `npm run build` - zero TypeScript errors
- **Test**: `npm test` - 22 tests passing across 3 test files
  - `client.test.ts` - 8 tests (mock fetch)
  - `tokens.test.ts` - 8 tests (mock VaultClient)
  - `front-desk.test.ts` - 6 tests (Fastify inject)

## Exports

The service exports `issueJobToken`, `revokeJobToken`, `getJobToken` for orchestrator integration.
