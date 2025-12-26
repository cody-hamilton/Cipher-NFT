import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("cipher:addresses", "Print deployed Cipher contract addresses").setAction(async function (_args: TaskArguments, hre) {
  const { deployments } = hre;

  const nft = await deployments.get("CipherNFT");
  const market = await deployments.get("CipherMarket");

  console.log(`CipherNFT: ${nft.address}`);
  console.log(`CipherMarket: ${market.address}`);
});

task("cipher:mint", "Mint a free Cipher NFT (one per address)")
  .addOptionalParam("nft", "CipherNFT address (defaults to deployments)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const nftDeployment = args.nft ? { address: args.nft } : await deployments.get("CipherNFT");
    const [signer] = await ethers.getSigners();

    const nft = await ethers.getContractAt("CipherNFT", nftDeployment.address);
    const tx = await nft.connect(signer).mint();
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    const supply = await nft.totalSupply();
    console.log(`Minted. totalSupply=${supply}`);
  });

task("cipher:list", "Create a market listing for a token")
  .addOptionalParam("market", "CipherMarket address (defaults to deployments)")
  .addOptionalParam("nft", "CipherNFT address (defaults to deployments)")
  .addParam("tokenid", "Token id to list")
  .addParam("pricewei", "Fixed buyNow price in wei")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const marketDeployment = args.market ? { address: args.market } : await deployments.get("CipherMarket");
    const nftDeployment = args.nft ? { address: args.nft } : await deployments.get("CipherNFT");
    const [signer] = await ethers.getSigners();

    const tokenId = BigInt(args.tokenid);
    const priceWei = BigInt(args.pricewei);

    const nft = await ethers.getContractAt("CipherNFT", nftDeployment.address);
    const market = await ethers.getContractAt("CipherMarket", marketDeployment.address);

    const approveTx = await nft.connect(signer).approve(marketDeployment.address, tokenId);
    await approveTx.wait();

    const tx = await market.connect(signer).createListing(tokenId, priceWei);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Listed tokenId=${tokenId} priceWei=${priceWei}`);
  });

task("cipher:bid", "Place an encrypted bid (seller will be able to decrypt)")
  .addOptionalParam("market", "CipherMarket address (defaults to deployments)")
  .addParam("listingid", "Listing id")
  .addParam("amountwei", "Bid amount in wei (will be encrypted)")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const marketDeployment = args.market ? { address: args.market } : await deployments.get("CipherMarket");
    const [signer] = await ethers.getSigners();

    const listingId = BigInt(args.listingid);
    const amountWei = BigInt(args.amountwei);

    const market = await ethers.getContractAt("CipherMarket", marketDeployment.address);

    const encrypted = await fhevm.createEncryptedInput(marketDeployment.address, signer.address).add64(amountWei).encrypt();

    const tx = await market.connect(signer).placeBid(listingId, encrypted.handles[0], encrypted.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Bid placed listingId=${listingId}`);
  });

task("cipher:decrypt-bid", "Decrypt a bid handle as the listing seller")
  .addOptionalParam("market", "CipherMarket address (defaults to deployments)")
  .addParam("listingid", "Listing id")
  .addParam("bidid", "Bid index")
  .setAction(async function (args: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const marketDeployment = args.market ? { address: args.market } : await deployments.get("CipherMarket");
    const [signer] = await ethers.getSigners();

    const listingId = BigInt(args.listingid);
    const bidId = BigInt(args.bidid);

    const market = await ethers.getContractAt("CipherMarket", marketDeployment.address);

    const bid = await market.getBid(listingId, bidId);
    const clear = await fhevm.userDecryptEuint(FhevmType.euint64, bid.encryptedAmount, marketDeployment.address, signer);
    console.log(`Clear bid amount: ${clear.toString()}`);
  });

