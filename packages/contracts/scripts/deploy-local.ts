import { ethers } from 'hardhat';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying contracts with account:', deployer.address);

  // Deploy FusioToken
  const TokenFactory = await ethers.getContractFactory('FusioToken');
  const token = await TokenFactory.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log('FusioToken deployed to:', tokenAddress);

  // Deploy FusioRegistry
  const RegistryFactory = await ethers.getContractFactory('FusioRegistry');
  const registry = await RegistryFactory.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log('FusioRegistry deployed to:', registryAddress);

  // Deploy FusioEscrow
  const EscrowFactory = await ethers.getContractFactory('FusioEscrow');
  const escrow = await EscrowFactory.deploy(tokenAddress, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log('FusioEscrow deployed to:', escrowAddress);

  // Write addresses to config
  const configDir = path.resolve(__dirname, '..', '..', '..', 'config');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const addresses = {
    FusioToken: tokenAddress,
    FusioEscrow: escrowAddress,
    FusioRegistry: registryAddress,
    deployer: deployer.address,
    chainId: 31337,
    deployedAt: new Date().toISOString()
  };

  const configPath = path.join(configDir, 'contracts.local.json');
  fs.writeFileSync(configPath, JSON.stringify(addresses, null, 2));
  console.log('Contract addresses written to:', configPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
