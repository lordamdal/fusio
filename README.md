# Fusio Protocol — Local Test Deployment Guide

> **Two Mac Mini M1s, one LAN, zero cloud.**
> This guide walks you through deploying and testing the full Fusio protocol on your local network.

---

## Architecture Overview

```
┌─────────────────────────────────────────────┐     LAN      ┌──────────────────────────────┐
│              MAC MINI #1                    │  ◄────────►  │        MAC MINI #2           │
│                                             │  192.168.x.x │                              │
│  ┌─────────────┐  ┌──────────────────────┐  │              │  ┌────────────────────────┐  │
│  │   NATS       │  │  Orchestrator :3000  │  │              │  │  Worker Node :3001     │  │
│  │   :4222      │  │  - Job routing       │  │              │  │  - Playwright browser  │  │
│  └─────────────┘  │  - Mock ledger       │  │              │  │  - Docker containers   │  │
│                    │  - Heartbeat monitor │  │              │  │  - Receipt signing     │  │
│  ┌─────────────┐  └──────────────────────┘  │              │  └────────────────────────┘  │
│  │ Vault :8200 │                             │              │                              │
│  │ FrontDesk   │  ┌──────────────────────┐  │              │  ┌────────────────────────┐  │
│  │   :8201     │  │  Fusio Desktop App   │  │              │  │  Docker: Chromium      │  │
│  └─────────────┘  │  (Tauri .dmg)        │  │              │  │  fusio-browser:latest  │  │
│                    └──────────────────────┘  │              │  └────────────────────────┘  │
│                                             │              │                              │
│  ┌─────────────┐                             │              │                              │
│  │ Hardhat     │  (optional, for contracts) │              │                              │
│  │   :8545     │                             │              │                              │
│  └─────────────┘                             │              │                              │
└─────────────────────────────────────────────┘              └──────────────────────────────┘
```

---

## Prerequisites (Both Machines)

```bash
# Node.js 22
node --version   # must be >= 22.0.0

# Docker Desktop (must be running)
docker --version

# Git
git --version
```

---

## Step 1 — Clone & Install (Both Machines)

```bash
# Clone the repo on BOTH Mac Minis
git clone <your-repo-url> fusio
cd fusio

# Install all dependencies (monorepo workspaces)
npm install

# Build the shared protocol-types package FIRST (everything depends on it)
cd packages/protocol-types && npm run build && cd ../..
```

---

## Step 2 — Build All Services

```bash
# Option A: Build everything at once
bash scripts/build-all.sh

# Option B: Build individually
cd packages/protocol-types && npm run build && cd ../..
cd services/orchestrator && npm run build && cd ../..
cd services/vault && npm run build && cd ../..
cd services/worker-node && npm run build && cd ../..
```

---

## Step 3 — Find Your LAN IPs

```bash
# On Mac Mini #1
ifconfig en0 | grep "inet " | awk '{print $2}'
# Example output: 192.168.1.100

# On Mac Mini #2
ifconfig en0 | grep "inet " | awk '{print $2}'
# Example output: 192.168.1.101
```

Write these down. You'll need them in the next steps.

---

## Step 4 — Mac Mini #1 (Orchestrator Machine)

### 4a. Start NATS

```bash
docker run -d --rm \
  --name fusio-nats \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:latest --http_port 8222

# Verify
curl -s http://localhost:8222/varz | head -5
```

### 4b. Start Vault (Optional — for credential features)

```bash
# Only if you have HashiCorp Vault installed:
# brew install vault
cd services/vault
bash vault-config/bootstrap.sh

# In a new terminal, start the front desk
VAULT_ADDR=http://localhost:8200 \
VAULT_ROOT_TOKEN=fusio-local-dev-token \
FRONT_DESK_PORT=8201 \
LOG_LEVEL=info \
node dist/index.js
```

### 4c. Start Orchestrator

```bash
cd services/orchestrator

# Create .env file with your IPs
cat > .env << 'EOF'
ORCHESTRATOR_PORT=3000
NATS_URL=nats://localhost:4222
LOG_LEVEL=info
MOCK_REQUESTER_BALANCE=100
MOCK_WORKER_BALANCE=0
FUSIO_KEY_PASSPHRASE=local-test-passphrase
DATA_DIR=./data
EOF

node dist/index.js

# Verify (in another terminal)
curl http://localhost:3000/health
# Should return: {"status":"ok","version":"0.1.0-local-test",...}
```

### 4d. Start the Desktop App (Optional)

```bash
cd apps/desktop

# Option A: Run the .dmg (if built)
open src-tauri/target/release/bundle/dmg/Fusio_0.1.0_aarch64.dmg

# Option B: Run in dev mode
npm run tauri dev
```

---

## Step 5 — Mac Mini #2 (Worker Machine)

### 5a. Build the Docker Browser Image

```bash
cd services/worker-node
bash scripts/build-image.sh

# Verify
docker images | grep fusio-browser
# Should show: fusio-browser   latest   ...   ~1.5GB
```

> **Note:** This image is ~1.5GB. Build it once — it persists across restarts.

### 5b. Start the Worker Node

Replace `192.168.1.100` with Mac Mini #1's actual LAN IP:

```bash
cd services/worker-node

cat > .env << EOF
ORCHESTRATOR_URL=http://192.168.1.100:3000
NATS_URL=nats://192.168.1.100:4222
WORKER_PORT=3001
LOG_LEVEL=info
FUSIO_KEY_PASSPHRASE=local-test-passphrase
DATA_DIR=./data
LOCAL_IP=192.168.1.101
EOF

node dist/index.js
```

You should see:
```
[WORKER] Worker <workerId> ready — connected to http://192.168.1.100:3000
```

### 5c. Verify Worker Registration

From Mac Mini #1:
```bash
curl http://localhost:3000/workers
# Should show your worker with status: "idle"
```

---

## Step 6 — Run the End-to-End Test

From Mac Mini #1:

```bash
cd tests
npx tsx e2e-test.ts
```

Expected output:
```
[E2E] Starting Fusio protocol end-to-end test
[E2E] Requester keypair generated: 5HueCGU8rMjx...
[E2E] Manifest created, jobId: <uuid>
[E2E] Job assigned to worker: <workerKey>...
[E2E] Job status: active | Step: 1
[E2E] Job status: active | Step: 2
[E2E] Job completed successfully
[E2E] Receipt ID: <uuid>
[E2E] Action count: 3
[E2E] ALL CHECKS PASSED
```

---

## Step 7 — Verify the Receipt

```bash
# On Mac Mini #1
cat services/orchestrator/data/receipts.jsonl | python3 -m json.tool

# Check for:
# - receiptId: valid UUID
# - outcome: "completed"
# - agentSignature: non-empty hex
# - workerSignature: non-empty hex
# - wipeHash: non-empty
# - actionCount > 0
```

---

## Running Tests (Any Machine)

```bash
# All tests
cd packages/protocol-types && npm test    # 13 tests
cd packages/contracts && npx hardhat test  # 19 tests
cd services/orchestrator && npm test       # 15 tests
cd services/worker-node && npm test        # 12 tests
cd services/vault && npm test              # 22 tests
# Total: 81 tests
```

---

## Smart Contracts (Optional)

The contracts run on a local Hardhat node — no real chain needed.

```bash
# Terminal 1: Start local EVM node
cd packages/contracts
npx hardhat node
# Runs on http://127.0.0.1:8545

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy-local.ts --network localhost
# Writes addresses to config/contracts.local.json

# Terminal 3: Seed test wallets
npx hardhat run scripts/seed-test-wallets.ts --network localhost
# Mints 10,000 FUS to requester, 1,000 FUS to worker
```

---

## Building the Desktop App (.dmg)

```bash
# Prerequisites
# - Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# - Xcode Command Line Tools: xcode-select --install

cd apps/desktop
npm run tauri build

# Output: src-tauri/target/release/bundle/dmg/Fusio_0.1.0_aarch64.dmg
```

To install: double-click the .dmg, drag Fusio to Applications.

---

## Ports Reference

| Service | Port | Machine |
|---------|------|---------|
| NATS | 4222 | Mac Mini #1 |
| NATS monitoring | 8222 | Mac Mini #1 |
| Orchestrator API | 3000 | Mac Mini #1 |
| Vault | 8200 | Mac Mini #1 |
| Vault Front Desk | 8201 | Mac Mini #1 |
| Hardhat EVM | 8545 | Mac Mini #1 |
| Worker Node | 3001 | Mac Mini #2 |

---

## Troubleshooting

### Worker can't connect to orchestrator
```bash
# From Mac Mini #2, test connectivity:
curl http://192.168.1.100:3000/health
# If this fails, check:
# 1. Orchestrator binds to 0.0.0.0 (not 127.0.0.1)
# 2. macOS Firewall allows Node.js connections
#    System Settings > Network > Firewall > Options > Allow Node.js
# 3. Both Macs are on the same network
```

### NATS connection refused
```bash
# Verify NATS is running and accessible:
docker ps | grep fusio-nats
curl http://localhost:8222/varz

# From Mac Mini #2:
# NATS must be reachable — check firewall for port 4222
```

### Docker image build fails on M1
```bash
# Make sure Docker Desktop is running with Rosetta enabled
# Docker Desktop > Settings > General > Use Rosetta for x86/amd64 emulation
# Or build with explicit platform:
docker build --platform linux/arm64 -t fusio-browser:latest -f docker/Dockerfile.browser .
```

### Heartbeat timeout / Job fails immediately
```bash
# The worker must send heartbeats every 5 seconds
# If the worker loses connection to orchestrator, jobs will timeout after 15s
# Check: is ORCHESTRATOR_URL correct in worker .env?
# Check: is the orchestrator actually running?
```

---

## Quick Start (Single Machine Testing)

If you want to test everything on a single Mac Mini first:

```bash
# Terminal 1: NATS
docker run -d --rm --name fusio-nats -p 4222:4222 nats:latest

# Terminal 2: Orchestrator
cd services/orchestrator && node dist/index.js

# Terminal 3: Worker
cd services/worker-node
ORCHESTRATOR_URL=http://localhost:3000 \
NATS_URL=nats://localhost:4222 \
WORKER_PORT=3001 \
FUSIO_KEY_PASSPHRASE=local-test-passphrase \
DATA_DIR=./data \
LOCAL_IP=127.0.0.1 \
node dist/index.js

# Terminal 4: E2E Test
cd tests && npx tsx e2e-test.ts
```

---

## Project Structure

```
fusio/
├── packages/
│   ├── protocol-types/     # Shared types, crypto, validation (13 tests)
│   └── contracts/          # Solidity: FusioToken, Escrow, Registry (19 tests)
├── services/
│   ├── orchestrator/       # HTTP API + NATS routing + mock ledger (15 tests)
│   ├── worker-node/        # Docker + Playwright browser automation (12 tests)
│   └── vault/              # Credential management + scoped tokens (22 tests)
├── apps/
│   ├── desktop/            # Tauri 2.0 + React desktop app (.dmg/.exe)
│   └── website/            # Download page for fusio.space
├── tests/                  # E2E integration test
├── config/                 # Deployed contract addresses
├── scripts/                # build-all.sh, start-all.sh, stop-all.sh
├── docker-compose.yml      # NATS infrastructure
└── README.md               # This file
```

---

## Token & Naming

| | Value |
|---|---|
| **Project** | Fusio |
| **Domain** | fusio.space |
| **Token** | FUS |
| **Bundle ID** | space.fusio.app |
| **Company** | Beaverhand Inc. |
| **Protocol Version** | 0.1.0-local-test |

---

*Built with Claude Code at the Fusio Hackathon, March 2026.*
