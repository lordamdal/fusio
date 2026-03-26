#!/bin/bash
set -e

echo "==================================="
echo " Fusio Protocol — Local Test Setup"
echo "==================================="
echo ""

FUSIO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FUSIO_ROOT"

# Step 1: Start NATS
echo "[1/5] Starting NATS..."
docker run -d --rm --name fusio-nats -p 4222:4222 -p 8222:8222 nats:latest --http_port 8222 2>/dev/null || echo "NATS already running"
sleep 1
echo "  ✓ NATS running on port 4222"

# Step 2: Start Vault (if installed)
echo "[2/5] Checking Vault..."
if command -v vault &> /dev/null; then
  cd "$FUSIO_ROOT/services/vault"
  bash vault-config/bootstrap.sh &
  sleep 3
  echo "  ✓ Vault running on port 8200"
else
  echo "  ⚠ Vault not installed — skipping (credential features will be mocked)"
fi

# Step 3: Start Vault front desk
echo "[3/5] Starting Vault front desk..."
cd "$FUSIO_ROOT/services/vault"
if [ -f "dist/index.js" ]; then
  VAULT_ADDR=http://localhost:8200 VAULT_ROOT_TOKEN=fusio-local-dev-token FRONT_DESK_PORT=8201 node dist/index.js &
  sleep 2
  echo "  ✓ Front desk on port 8201"
else
  echo "  ⚠ Vault service not built — run 'npm run build' in services/vault first"
fi

# Step 4: Start Orchestrator
echo "[4/5] Starting Orchestrator..."
cd "$FUSIO_ROOT/services/orchestrator"
if [ -f "dist/index.js" ]; then
  ORCHESTRATOR_PORT=3000 NATS_URL=nats://localhost:4222 MOCK_REQUESTER_BALANCE=100 MOCK_WORKER_BALANCE=0 FUSIO_KEY_PASSPHRASE=local-test-passphrase DATA_DIR=./data LOG_LEVEL=info node dist/index.js &
  sleep 2
  echo "  ✓ Orchestrator on port 3000"
else
  echo "  ⚠ Orchestrator not built — run 'npm run build' in services/orchestrator first"
fi

# Step 5: Start Worker Node
echo "[5/5] Starting Worker Node..."
cd "$FUSIO_ROOT/services/worker-node"
if [ -f "dist/index.js" ]; then
  ORCHESTRATOR_URL=http://localhost:3000 NATS_URL=nats://localhost:4222 WORKER_PORT=3001 FUSIO_KEY_PASSPHRASE=local-test-passphrase DATA_DIR=./data LOCAL_IP=127.0.0.1 LOG_LEVEL=info node dist/index.js &
  sleep 2
  echo "  ✓ Worker on port 3001"
else
  echo "  ⚠ Worker not built — run 'npm run build' in services/worker-node first"
fi

echo ""
echo "==================================="
echo " Fusio Protocol — Services Status"
echo "==================================="
echo ""
echo "  NATS:         http://localhost:4222"
echo "  Vault:        http://localhost:8200"
echo "  Front Desk:   http://localhost:8201"
echo "  Orchestrator: http://localhost:3000"
echo "  Worker Node:  http://localhost:3001"
echo ""
echo "Run 'curl http://localhost:3000/health' to verify the orchestrator."
echo "Press Ctrl+C to stop all services."
echo ""

wait
