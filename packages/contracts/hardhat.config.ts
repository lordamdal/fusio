import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: { mnemonic: 'test test test test test test test test test test test junk' }
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337
    }
  }
};
export default config;
