import { ethers, Contract, Provider, Signer } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// ABI fragments for the contracts
const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
  'function burn(uint256 amount)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

const ESCROW_ABI = [
  'function token() view returns (address)',
  'function orchestrator() view returns (address)',
  'function setOrchestrator(address)',
  'function lockEscrow(bytes32 jobId, address worker, uint256 amount)',
  'function releaseEscrow(bytes32 jobId, bytes32 receiptHash)',
  'function returnEscrow(bytes32 jobId, uint8 faultClass)',
  'function getJob(bytes32 jobId) view returns (tuple(bytes32 jobId, address requester, address worker, uint256 amount, uint256 startedAt, uint256 completedAt, uint8 status, uint8 faultClass, bytes32 receiptHash))',
  'function getJobStatus(bytes32 jobId) view returns (uint8)',
  'event EscrowLocked(bytes32 indexed jobId, address requester, address worker, uint256 amount)',
  'event EscrowReleased(bytes32 indexed jobId, address worker, uint256 amount, bytes32 receiptHash)',
  'event EscrowReturned(bytes32 indexed jobId, address requester, uint256 amount, uint8 faultClass)'
];

const REGISTRY_ABI = [
  'function orchestrator() view returns (address)',
  'function setOrchestrator(address)',
  'function registerAgent(bytes32 agentId, address wallet)',
  'function deactivateAgent(bytes32 agentId)',
  'function isRegistered(bytes32 agentId) view returns (bool)',
  'function writeReceipt(tuple(bytes32 receiptId, bytes32 jobId, bytes32 agentId, bytes32 workerIdHash, bytes32 jobHash, uint256 completedAt, uint8 outcome, uint256 costAgr))',
  'function getReceipt(bytes32 receiptId) view returns (tuple(bytes32 receiptId, bytes32 jobId, bytes32 agentId, bytes32 workerIdHash, bytes32 jobHash, uint256 completedAt, uint8 outcome, uint256 costAgr))',
  'event AgentRegistered(bytes32 indexed agentId, address wallet)',
  'event AgentDeactivated(bytes32 indexed agentId)',
  'event ReceiptWritten(bytes32 indexed receiptId, bytes32 indexed jobId)'
];

export interface LocalAddresses {
  FusioToken: string;
  FusioEscrow: string;
  FusioRegistry: string;
  deployer: string;
  chainId: number;
  deployedAt: string;
}

export function loadLocalAddresses(
  configPath?: string
): LocalAddresses {
  const resolvedPath =
    configPath ??
    path.resolve(__dirname, '..', '..', '..', 'config', 'contracts.local.json');
  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  return JSON.parse(raw) as LocalAddresses;
}

export function getTokenContract(
  address: string,
  signerOrProvider: Signer | Provider
): Contract {
  return new ethers.Contract(address, TOKEN_ABI, signerOrProvider);
}

export function getEscrowContract(
  address: string,
  signerOrProvider: Signer | Provider
): Contract {
  return new ethers.Contract(address, ESCROW_ABI, signerOrProvider);
}

export function getRegistryContract(
  address: string,
  signerOrProvider: Signer | Provider
): Contract {
  return new ethers.Contract(address, REGISTRY_ABI, signerOrProvider);
}
