// Identity
export {
  type AgentIdentity,
  type AgentKeypair,
  type SignedPayload,
  AgentIdentitySchema,
  SignedPayloadSchema,
  generateKeypair,
  signPayload,
  verifySignature,
  loadOrCreateKeypair,
  toBase58,
  fromBase58,
  bytesToHex,
  hexToBytes,
} from './identity.js';

// Manifest
export {
  type JobCategory,
  type MemoryPolicy,
  type FailoverPolicy,
  type JobManifest,
  JobCategorySchema,
  MemoryPolicySchema,
  FailoverPolicySchema,
  JobManifestSchema,
  PROHIBITED_CATEGORIES,
  createManifest,
  validateManifest,
} from './manifest.js';

// Packets
export {
  type ActionType,
  type ActionTarget,
  type ActionPacket,
  type ObservationPacket,
  ActionTypeSchema,
  ActionTargetSchema,
  ActionPacketSchema,
  ObservationPacketSchema,
  createActionPacket,
  createObservationPacket,
  verifyActionPacket,
  verifyObservationPacket,
} from './packets.js';

// Receipt
export {
  type JobOutcome,
  type FaultClass,
  type CompletionReceipt,
  JobOutcomeSchema,
  FaultClassSchema,
  CompletionReceiptSchema,
  createReceipt,
  signReceiptAsAgent,
  signReceiptAsWorker,
  verifyReceipt,
} from './receipt.js';

// Errors
export {
  FusioErrorCode,
  type FusioError,
  FusioErrorCodeSchema,
  FusioErrorSchema,
  FUSIO_ERROR_CODES,
  createFusioError,
} from './errors.js';

// Constants
export {
  PROTOCOL_VERSION,
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
  MAX_STEPS_PER_JOB,
  MAX_JOB_DURATION_MS,
  MIN_SCREENSHOT_INTERVAL_MS,
  RECEIPT_LOG_PATH,
  KEYPAIR_DIR,
  MOCK_AGR_ESCROW_AMOUNT,
  NATS_DEFAULT_URL,
  ORCHESTRATOR_HTTP_PORT,
  WORKER_HTTP_PORT,
  VAULT_HTTP_PORT,
} from './constants.js';
