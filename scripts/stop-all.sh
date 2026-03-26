#!/bin/bash
echo "Stopping Fusio services..."

# Kill Node.js services
pkill -f "services/orchestrator/dist" 2>/dev/null || true
pkill -f "services/worker-node/dist" 2>/dev/null || true
pkill -f "services/vault/dist" 2>/dev/null || true

# Stop NATS
docker stop fusio-nats 2>/dev/null || true

# Stop Vault
pkill -f "vault server -dev" 2>/dev/null || true

echo "All Fusio services stopped."
