import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const configPath = path.resolve(__dirname, '..', '..', '..', 'config', 'contracts.local.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('contracts.local.json not found. Run deploy:local first.');
  }

  const addresses = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const signers = await ethers.getSigners();
  const owner = signers[0];
  const requester = signers[1];
  const worker = signers[2];

  const token = await ethers.getContractAt('FusioToken', addresses.FusioToken);

  // Mint 10,000 FUS to requester
  const requesterAmount = ethers.parseEther('10000');
  await token.connect(owner).mint(requester.address, requesterAmount);
  console.log(`Minted 10,000 FUS to requester: ${requester.address}`);

  // Mint 1,000 FUS to worker
  const workerAmount = ethers.parseEther('1000');
  await token.connect(owner).mint(worker.address, workerAmount);
  console.log(`Minted 1,000 FUS to worker: ${worker.address}`);

  console.log('Seeding complete.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
