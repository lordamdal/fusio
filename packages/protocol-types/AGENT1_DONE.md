# Agent 1 — Protocol Types — DONE

## Exports

### Types / Interfaces
- `AgentIdentity`, `AgentKeypair`, `SignedPayload`
- `JobCategory`, `MemoryPolicy`, `FailoverPolicy`, `JobManifest`
- `ActionType`, `ActionTarget`, `ActionPacket`, `ObservationPacket`
- `JobOutcome`, `FaultClass`, `CompletionReceipt`
- `FusioErrorCode` (enum), `FusioError`

### Zod Schemas
- `AgentIdentitySchema`, `SignedPayloadSchema`
- `JobCategorySchema`, `MemoryPolicySchema`, `FailoverPolicySchema`, `JobManifestSchema`
- `ActionTypeSchema`, `ActionTargetSchema`, `ActionPacketSchema`, `ObservationPacketSchema`
- `JobOutcomeSchema`, `FaultClassSchema`, `CompletionReceiptSchema`
- `FusioErrorCodeSchema`, `FusioErrorSchema`

### Functions
- `generateKeypair()`, `signPayload()`, `verifySignature()`, `loadOrCreateKeypair()`
- `toBase58()`, `fromBase58()`, `bytesToHex()`, `hexToBytes()`
- `createManifest()`, `validateManifest()`
- `createActionPacket()`, `createObservationPacket()`, `verifyActionPacket()`, `verifyObservationPacket()`
- `createReceipt()`, `signReceiptAsAgent()`, `signReceiptAsWorker()`, `verifyReceipt()`
- `createFusioError()`

### Constants
- `PROTOCOL_VERSION`, `HEARTBEAT_INTERVAL_MS`, `HEARTBEAT_TIMEOUT_MS`
- `MAX_STEPS_PER_JOB`, `MAX_JOB_DURATION_MS`, `MIN_SCREENSHOT_INTERVAL_MS`
- `RECEIPT_LOG_PATH`, `KEYPAIR_DIR`, `MOCK_AGR_ESCROW_AMOUNT`
- `NATS_DEFAULT_URL`, `ORCHESTRATOR_HTTP_PORT`, `WORKER_HTTP_PORT`, `VAULT_HTTP_PORT`
- `PROHIBITED_CATEGORIES`, `FUSIO_ERROR_CODES`

## Import
```typescript
import { generateKeypair, createManifest, ... } from '@fusio/protocol-types';
```
