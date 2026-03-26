import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FusioToken, FusioEscrow } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('FusioEscrow', () => {
  let token: FusioToken;
  let escrow: FusioEscrow;
  let owner: HardhatEthersSigner;
  let requester: HardhatEthersSigner;
  let worker: HardhatEthersSigner;
  let orchestrator: HardhatEthersSigner;

  const jobId = ethers.id('job-001');
  const amount = ethers.parseEther('100');
  const receiptHash = ethers.id('receipt-hash');

  beforeEach(async () => {
    [owner, requester, worker, orchestrator] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory('FusioToken');
    token = await TokenFactory.deploy();
    await token.waitForDeployment();

    const EscrowFactory = await ethers.getContractFactory('FusioEscrow');
    escrow = await EscrowFactory.deploy(
      await token.getAddress(),
      orchestrator.address
    );
    await escrow.waitForDeployment();

    // Fund requester
    await token.mint(requester.address, ethers.parseEther('10000'));
    // Approve escrow
    await token.connect(requester).approve(await escrow.getAddress(), ethers.MaxUint256);
  });

  it('should lock escrow and transfer tokens', async () => {
    await escrow.connect(requester).lockEscrow(jobId, worker.address, amount);

    expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);

    const job = await escrow.getJob(jobId);
    expect(job.requester).to.equal(requester.address);
    expect(job.worker).to.equal(worker.address);
    expect(job.amount).to.equal(amount);
    expect(job.status).to.equal(1); // Active
  });

  it('should release escrow to worker', async () => {
    await escrow.connect(requester).lockEscrow(jobId, worker.address, amount);

    const workerBefore = await token.balanceOf(worker.address);
    await escrow.connect(orchestrator).releaseEscrow(jobId, receiptHash);
    const workerAfter = await token.balanceOf(worker.address);

    expect(workerAfter - workerBefore).to.equal(amount);

    const job = await escrow.getJob(jobId);
    expect(job.status).to.equal(2); // Completed
    expect(job.receiptHash).to.equal(receiptHash);
  });

  it('should return escrow to requester on failure', async () => {
    await escrow.connect(requester).lockEscrow(jobId, worker.address, amount);

    const requesterBefore = await token.balanceOf(requester.address);
    // FaultClass.WorkerFault = 1
    await escrow.connect(orchestrator).returnEscrow(jobId, 1);
    const requesterAfter = await token.balanceOf(requester.address);

    expect(requesterAfter - requesterBefore).to.equal(amount);

    const job = await escrow.getJob(jobId);
    expect(job.status).to.equal(3); // Failed
    expect(job.faultClass).to.equal(1); // WorkerFault
  });

  it('should revert on double lock', async () => {
    await escrow.connect(requester).lockEscrow(jobId, worker.address, amount);
    await expect(
      escrow.connect(requester).lockEscrow(jobId, worker.address, amount)
    ).to.be.revertedWith('Job already exists');
  });

  it('should revert release from non-orchestrator', async () => {
    await escrow.connect(requester).lockEscrow(jobId, worker.address, amount);
    await expect(
      escrow.connect(requester).releaseEscrow(jobId, receiptHash)
    ).to.be.revertedWith('Only orchestrator');
  });

  it('full lifecycle: lock -> release -> verify balances', async () => {
    const requesterBefore = await token.balanceOf(requester.address);

    await escrow.connect(requester).lockEscrow(jobId, worker.address, amount);
    expect(await escrow.getJobStatus(jobId)).to.equal(1); // Active

    await escrow.connect(orchestrator).releaseEscrow(jobId, receiptHash);
    expect(await escrow.getJobStatus(jobId)).to.equal(2); // Completed

    const requesterAfter = await token.balanceOf(requester.address);
    const workerBalance = await token.balanceOf(worker.address);

    expect(requesterBefore - requesterAfter).to.equal(amount);
    expect(workerBalance).to.equal(amount);
  });
});
