import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { CipherMarket, CipherMarket__factory, CipherNFT, CipherNFT__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const nftFactory = (await ethers.getContractFactory("CipherNFT")) as CipherNFT__factory;
  const nft = (await nftFactory.deploy()) as CipherNFT;
  const nftAddress = await nft.getAddress();

  const marketFactory = (await ethers.getContractFactory("CipherMarket")) as CipherMarket__factory;
  const market = (await marketFactory.deploy(nftAddress)) as CipherMarket;
  const marketAddress = await market.getAddress();

  return { nft, nftAddress, market, marketAddress };
}

describe("CipherMarket", function () {
  let signers: Signers;
  let nft: CipherNFT;
  let nftAddress: string;
  let market: CipherMarket;
  let marketAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ nft, nftAddress, market, marketAddress } = await deployFixture());
  });

  it("allows each address to mint exactly once", async function () {
    await expect(nft.connect(signers.alice).mint()).to.emit(nft, "Transfer");
    await expect(nft.connect(signers.alice).mint()).to.be.revertedWith("ALREADY_MINTED");
    await expect(nft.connect(signers.bob).mint()).to.emit(nft, "Transfer");
  });

  it("creates listing and supports buyNow", async function () {
    await nft.connect(signers.alice).mint().then((tx) => tx.wait());
    const tokenId = 1n;

    await nft.connect(signers.alice).approve(await market.getAddress(), tokenId);

    const price = ethers.parseEther("0.01");
    await expect(market.connect(signers.alice).createListing(tokenId, price)).to.emit(market, "ListingCreated");

    await expect(market.connect(signers.bob).buyNow(1, { value: price })).to.emit(market, "ListingBought");
    expect(await nft.ownerOf(tokenId)).to.eq(signers.bob.address);
    expect(await market.proceeds(signers.alice.address)).to.eq(price);
  });

  it("stores encrypted bids, allows seller to decrypt, and supports accept+settle", async function () {
    const mintTx = await nft.connect(signers.alice).mint();
    await mintTx.wait();
    const tokenId = 1n;

    await nft.connect(signers.alice).approve(marketAddress, tokenId);
    await market.connect(signers.alice).createListing(tokenId, ethers.parseEther("0.02"));

    const bidAmountWei = 123_456_789n;
    const encryptedBid = await fhevm
      .createEncryptedInput(marketAddress, signers.bob.address)
      .add64(bidAmountWei)
      .encrypt();

    await expect(market.connect(signers.bob).placeBid(1, encryptedBid.handles[0], encryptedBid.inputProof)).to.emit(
      market,
      "BidPlaced",
    );

    const bid = await market.getBid(1, 0);
    const decryptedBid = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      bid.encryptedAmount,
      marketAddress,
      signers.alice,
    );
    expect(decryptedBid).to.eq(bidAmountWei);

    await expect(market.connect(signers.alice).acceptBid(1, 0, bidAmountWei)).to.emit(market, "BidAccepted");
    await expect(market.connect(signers.bob).settleAcceptedBid(1, { value: bidAmountWei })).to.emit(market, "BidSettled");

    expect(await nft.ownerOf(tokenId)).to.eq(signers.bob.address);
    expect(await market.proceeds(signers.alice.address)).to.eq(bidAmountWei);
  });

  it("allows seller to withdraw proceeds", async function () {
    await nft.connect(signers.alice).mint();
    const tokenId = 1n;
    await nft.connect(signers.alice).approve(marketAddress, tokenId);

    const price = ethers.parseEther("0.01");
    await market.connect(signers.alice).createListing(tokenId, price);
    await market.connect(signers.bob).buyNow(1, { value: price });

    await expect(market.connect(signers.alice).withdrawProceeds()).to.emit(market, "ProceedsWithdrawn");
    expect(await market.proceeds(signers.alice.address)).to.eq(0);
  });
});
