# Agent 2 - Smart Contracts Package

## Status: CREATED (pending compile + test)

## Package: `@fusio/contracts`

### Contracts
- **FusioToken.sol** - ERC-20 token (Fusio/FUS), 1M initial supply, owner-only mint, holder burn
- **FusioEscrow.sol** - Escrow with lock/release/return, orchestrator-gated, fault classification
- **FusioRegistry.sol** - Agent registration and on-chain receipt storage

### Tests
- `test/FusioToken.test.ts` - 6 tests: name/symbol/decimals, initial supply, mint, mint-reject, transfer, burn
- `test/FusioEscrow.test.ts` - 6 tests: lock, release, return, double-lock revert, non-orchestrator revert, full lifecycle
- `test/FusioRegistry.test.ts` - 7 tests: register, isRegistered, deactivate, deactivate-reject, writeReceipt, duplicate-revert, non-orchestrator revert

### Scripts
- `scripts/deploy-local.ts` - Deploys all 3 contracts, writes addresses to `config/contracts.local.json`
- `scripts/seed-test-wallets.ts` - Mints 10,000 FUS to requester, 1,000 FUS to worker

### Client
- `src/client.ts` - TypeScript client with `getTokenContract`, `getEscrowContract`, `getRegistryContract`, `loadLocalAddresses`

### To complete setup
```bash
cd packages/contracts
npm install       # already done
npx hardhat compile
npx hardhat test
```

### Dependencies
- Hardhat 2.22+
- OpenZeppelin Contracts v5
- ethers v6
- Solidity 0.8.24
