import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { deployments, ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { CipherMarket, CipherNFT } from "../types";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("CipherMarketSepolia", function () {
  let signers: Signers;
  let nft: CipherNFT;
  let market: CipherMarket;
  let nftAddress: string;
  let marketAddress: string;

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const nftDeployment = await deployments.get("CipherNFT");
      const marketDeployment = await deployments.get("CipherMarket");
      nftAddress = nftDeployment.address;
      marketAddress = marketDeployment.address;
      nft = await ethers.getContractAt("CipherNFT", nftAddress);
      market = await ethers.getContractAt("CipherMarket", marketAddress);
    } catch (e) {
      (e as Error).message += ". Deploy first: 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  it("can decrypt a bid as the listing seller", async function () {
    this.timeout(4 * 60000);

    const hasMinted = await nft.hasMinted(signers.alice.address);
    if (!hasMinted) {
      const tx = await nft.connect(signers.alice).mint();
      await tx.wait();
    }

    const tokens = await nft.tokensOfOwner(signers.alice.address);
    expect(tokens.length).to.be.greaterThan(0);
    const tokenId = tokens[0];

    const approved = await nft.getApproved(tokenId);
    if (approved.toLowerCase() !== marketAddress.toLowerCase()) {
      const tx = await nft.connect(signers.alice).approve(marketAddress, tokenId);
      await tx.wait();
    }

    const listingId = await market.listingIdByTokenId(tokenId);
    if (listingId === 0n) {
      const tx = await market.connect(signers.alice).createListing(tokenId, 1n);
      await tx.wait();
    }

    const count = await market.getBidCount(listingId);
    if (count === 0n) {
      console.warn("No bids found on this listing yet. Place a bid from another account then re-run the test.");
      this.skip();
    }

    const bid = await market.getBid(listingId, 0);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, bid.encryptedAmount, marketAddress, signers.alice);
    expect(clear).to.be.a("bigint");
  });
});

