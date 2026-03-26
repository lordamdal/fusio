import { expect } from 'chai';
import { ethers } from 'hardhat';
import { FusioToken } from '../typechain-types';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

describe('FusioToken', () => {
  let token: FusioToken;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;

  beforeEach(async () => {
    [owner, alice] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('FusioToken');
    token = await Factory.deploy();
    await token.waitForDeployment();
  });

  it('should have correct name, symbol, and decimals', async () => {
    expect(await token.name()).to.equal('Fusio');
    expect(await token.symbol()).to.equal('FUS');
    expect(await token.decimals()).to.equal(18);
  });

  it('should mint initial supply to deployer', async () => {
    const expected = ethers.parseEther('1000000');
    expect(await token.balanceOf(owner.address)).to.equal(expected);
  });

  it('should allow owner to mint', async () => {
    const amount = ethers.parseEther('500');
    await token.mint(alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  it('should reject mint from non-owner', async () => {
    const amount = ethers.parseEther('500');
    await expect(
      token.connect(alice).mint(alice.address, amount)
    ).to.be.revertedWithCustomError(token, 'OwnableUnauthorizedAccount');
  });

  it('should allow transfer', async () => {
    const amount = ethers.parseEther('100');
    await token.transfer(alice.address, amount);
    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  it('should allow holder to burn', async () => {
    const burnAmount = ethers.parseEther('100');
    const initial = await token.balanceOf(owner.address);
    await token.burn(burnAmount);
    expect(await token.balanceOf(owner.address)).to.equal(initial - burnAmount);
  });
});
