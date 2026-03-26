#!/bin/bash
vault server -dev \
  -dev-root-token-id="fusio-local-dev-token" \
  -dev-listen-address="0.0.0.0:8200" &
sleep 2
export VAULT_ADDR='http://0.0.0.0:8200'
export VAULT_TOKEN='fusio-local-dev-token'
vault secrets enable -path=fusio-secrets kv-v2
vault policy write orchestrator vault-config/policy-orchestrator.hcl
vault policy write worker vault-config/policy-worker.hcl
echo "[VAULT] Vault dev server ready at http://0.0.0.0:8200"
