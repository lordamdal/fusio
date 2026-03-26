# Fusio Protocol — Claude Code Configuration

## Project overview
Fusio is a decentralized compute protocol connecting AI agent requesters with worker nodes that execute browser-based tasks. This repo contains the full stack: shared types, smart contracts, orchestrator, worker node, vault/credentials, and a Tauri desktop app.

## Monorepo structure
```
fusio/
├── packages/
│   ├── protocol-types/    Shared TypeScript types, crypto, validation (ESM)
│   └── contracts/         Solidity contracts on Hardhat (CommonJS)
├── services/
│   ├── orchestrator/      HTTP API + NATS message routing (ESM)
│   ├── worker-node/       Docker + Playwright job execution (ESM)
│   └── vault/             HashiCorp Vault credential management (ESM)
├── apps/
│   ├── desktop/           Tauri 2.0 + React + Vite desktop app
│   └── website/           Static download page
├── tests/                 E2E integration tests
├── config/                Shared config files
└── scripts/               Build/start/stop scripts
```

## Key conventions
- All TypeScript services use ESM (`"type": "module"`) except contracts (Hardhat needs CommonJS)
- All ESM imports must include `.js` extension
- Pino logger: `import { pino } from 'pino'` (named export)
- Token symbol: FUS (not AGR)
- Project name: Fusio (domain: fusio.space)
- Ed25519 crypto via `@noble/ed25519`
- Protocol types: import from `@fusio/protocol-types`

## Commands
- Build all: `bash scripts/build-all.sh`
- Start all services: `bash scripts/start-all.sh`
- Stop all: `bash scripts/stop-all.sh`
- Run E2E test: `cd tests && npx tsx e2e-test.ts`

## Per-package commands
- protocol-types: `npm run build`, `npm test` (vitest)
- contracts: `npx hardhat compile`, `npx hardhat test`
- orchestrator: `npm run build`, `npm test` (vitest)
- worker-node: `npm run build`, `npm test` (vitest)
- vault: `npm run build`, `npm test` (vitest)
- desktop: `npm run build` (vite), `npm run tauri dev`
