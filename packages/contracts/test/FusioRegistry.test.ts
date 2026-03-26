import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FusioRegistry } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('FusioRegistry', () => {
  let registry: FusioRegistry;
  let owner: HardhatEthersSigner;
  let orchestrator: HardhatEthersSigner;
  let agentWallet: HardhatEthersSigner;
  let other: HardhatEthersSigner;

  const agentId = ethers.id('agent-001');

  beforeEach(async () => {
    [owner, orchestrator, agentWallet, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('FusioRegistry');
    registry = await Factory.deploy(orchestrator.address);
    await registry.waitForDeployment();
  });

  it('should register an agent', async () => {
    await registry.registerAgent(agentId, agentWallet.address);
    const agent = await registry.agents(agentId);
    expect(agent.wallet).to.equal(agentWallet.address);
    expect(agent.active).to.equal(true);
  });

  it('should report isRegistered correctly', async () => {
    expect(await registry.isRegistered(agentId)).to.equal(false);
    await registry.registerAgent(agentId, agentWallet.address);
    expect(await registry.isRegistered(agentId)).to.equal(true);
  });

  it('should deactivate an agent', async () => {
    await registry.connect(agentWallet).registerAgent(agentId, agentWallet.address);
    expect(await registry.isRegistered(agentId)).to.equal(true);

    await registry.connect(agentWallet).deactivateAgent(agentId);
    expect(await registry.isRegistered(agentId)).to.equal(false);
  });

  it('should reject deactivation from non-owner of agent', async () => {
    await registry.registerAgent(agentId, agentWallet.address);
    await expect(
      registry.connect(other).deactivateAgent(agentId)
    ).to.be.revertedWith('Not agent owner');
  });

  it('should write a receipt', async () => {
    const receiptId = ethers.id('receipt-001');
    const jobId = ethers.id('job-001');
    const workerIdHash = ethers.id('worker-001');
    const jobHash = ethers.id('job-hash');

    const receipt = {
      receiptId,
      jobId,
      agentId,
      workerIdHash,
      jobHash,
      completedAt: 1700000000,
      outcome: 1,
      costAgr: ethers.parseEther('50')
    };

    await registry.connect(orchestrator).writeReceipt(receipt);
    const stored = await registry.getReceipt(receiptId);
    expect(stored.jobId).to.equal(jobId);
    expect(stored.outcome).to.equal(1);
    expect(stored.costAgr).to.equal(ethers.parseEther('50'));
  });

  it('should revert on duplicate receipt', async () => {
    const receiptId = ethers.id('receipt-002');
    const receipt = {
      receiptId,
      jobId: ethers.id('job-002'),
      agentId,
      workerIdHash: ethers.id('worker-002'),
      jobHash: ethers.id('job-hash-2'),
      completedAt: 1700000000,
      outcome: 1,
      costAgr: ethers.parseEther('10')
    };

    await registry.connect(orchestrator).writeReceipt(receipt);
    await expect(
      registry.connect(orchestrator).writeReceipt(receipt)
    ).to.be.revertedWith('Receipt already exists');
  });

  it('should reject writeReceipt from non-orchestrator', async () => {
    const receipt = {
      receiptId: ethers.id('receipt-003'),
      jobId: ethers.id('job-003'),
      agentId,
      workerIdHash: ethers.id('worker-003'),
      jobHash: ethers.id('job-hash-3'),
      completedAt: 1700000000,
      outcome: 1,
      costAgr: ethers.parseEther('10')
    };

    await expect(
      registry.connect(other).writeReceipt(receipt)
    ).to.be.revertedWith('Only orchestrator');
  });
});
