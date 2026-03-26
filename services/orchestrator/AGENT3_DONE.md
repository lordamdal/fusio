# Agent 3 - Orchestrator Service

## Status: COMPLETE

## Summary
Built the Fusio orchestrator service at `services/orchestrator/`. The service provides HTTP API endpoints for job submission, worker registration, and health checks, backed by an in-memory job store, worker registry, mock escrow ledger, and NATS messaging (optional).

## Files Created

### Configuration
- `package.json` - ESM package with all dependencies
- `tsconfig.json` - Extends base config
- `.env` / `.env.example` - Environment configuration

### Source (`src/`)
- `index.ts` - Entry point: Fastify server, NATS connection with retry, heartbeat monitor
- `api/routes.ts` - Route registration hub
- `api/health.ts` - GET /health endpoint
- `api/jobs.ts` - POST /jobs, GET /jobs, GET /jobs/:id
- `api/workers.ts` - POST /workers/register, POST /workers/:id/heartbeat, GET /workers
- `core/registry.ts` - In-memory worker registry
- `core/matcher.ts` - Worker capability matching
- `core/heartbeat.ts` - Heartbeat timeout monitor
- `core/ledger.ts` - Mock escrow ledger
- `messaging/nats.ts` - NATS connection helper with retry/backoff
- `messaging/subjects.ts` - NATS subject name constants
- `db/jobs.ts` - In-memory job state store
- `db/receipts.ts` - Receipt JSONL writer

### Tests (`src/__tests__/`)
- `api.test.ts` - 5 tests (valid job, invalid manifest, prohibited category, no workers, health)
- `ledger.test.ts` - 5 tests (lock, release, return, double-lock, insufficient balance)
- `registry.test.ts` - 4 tests (register, busy/idle, available filter, no match)
- `heartbeat.test.ts` - 1 test (timeout triggers job failure)

## Verification
- `npm install` - OK
- `npm run build` - 0 TypeScript errors
- `npm test` - 15/15 tests passed
