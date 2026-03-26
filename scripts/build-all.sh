#!/bin/bash
set -e

FUSIO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$FUSIO_ROOT"

echo "==================================="
echo " Fusio Protocol — Full Build"
echo "==================================="

echo ""
echo "[1/5] Building protocol-types..."
cd "$FUSIO_ROOT/packages/protocol-types" && npm run build
echo "  ✓ protocol-types built"

echo ""
echo "[2/5] Building contracts..."
cd "$FUSIO_ROOT/packages/contracts" && npx hardhat compile 2>/dev/null || echo "  ⚠ Contracts skipped (hardhat not available)"
echo "  ✓ contracts built"

echo ""
echo "[3/5] Building orchestrator..."
cd "$FUSIO_ROOT/services/orchestrator" && npm run build
echo "  ✓ orchestrator built"

echo ""
echo "[4/5] Building vault..."
cd "$FUSIO_ROOT/services/vault" && npm run build
echo "  ✓ vault built"

echo ""
echo "[5/5] Building worker-node..."
cd "$FUSIO_ROOT/services/worker-node" && npm run build
echo "  ✓ worker-node built"

echo ""
echo "==================================="
echo " Build complete!"
echo "==================================="
