# Cipher NFT

Cipher NFT is a free-mint NFT collection with a privacy-first marketplace. Everyone can mint exactly one NFT, list it for
sale, and receive encrypted bids. Only the listing owner can decrypt bids using Zama FHE, accept one, and settle the
payment.

## Project Goals

- Give every address a free, one-time mint to bootstrap a community collection.
- Enable a transparent listing market while keeping bid values private.
- Demonstrate practical, end-to-end use of FHEVM in a consumer-facing NFT flow.
- Keep the stack minimal, auditable, and easy to run locally or on Sepolia.

## Core Features

- **Free Mint**: one NFT per address, no mint fee.
- **On-chain SVG Metadata**: tokenURI is fully on-chain with a generated SVG.
- **Listings**: owners can list NFTs with a fixed “buy now” price.
- **Encrypted Bids**: bidders submit encrypted amounts; the seller alone can decrypt.
- **Bid Acceptance**: seller can accept a bid and set the clear price after decryption.
- **Escrow + Settlement**: listed NFTs are held by the market until sold or cancelled.
- **Withdrawals**: sellers withdraw proceeds after sales or accepted bids settle.

## Advantages

- **Privacy-preserving price discovery**: bids are encrypted end-to-end.
- **Simple user flow**: mint → list → bid → accept → settle.
- **No backend custody**: all market logic is on-chain.
- **Gas-efficient listing**: only essential fields are stored on-chain.
- **Interoperable UI**: wallet-first flow with RainbowKit and Wagmi.

## Problems Solved

- **Bid privacy**: prevents front-running and bid sniping based on clear-text prices.
- **Fairer negotiations**: sellers can review multiple encrypted bids without revealing them.
- **Easy onboarding**: free mint avoids initial cost barriers.
- **Trust minimization**: NFT escrow and payments are enforced by the contract.

## Tech Stack

- **Smart contracts**: Solidity `0.8.24`
- **Framework**: Hardhat
- **FHE**: Zama FHEVM (`@fhevm/solidity`)
- **Frontend**: React + Vite + TypeScript
- **Wallet + Web3**: RainbowKit + Wagmi
- **On-chain reads**: Viem
- **On-chain writes**: Ethers
- **Encrypted bid relayer**: `@zama-fhe/relayer-sdk`

## Architecture Overview

1. **CipherNFT** mints a one-per-address NFT and serves on-chain metadata.
2. **CipherMarket** escrows listed NFTs and records encrypted bids.
3. **Frontend** encrypts bid amounts via the Zama relayer, submits ciphertext on-chain,
   and allows the seller to decrypt off-chain before accepting.

## Smart Contracts

### `CipherNFT.sol`

- One mint per address (`mint()`)
- Tracks ownership and per-owner token lists
- `tokenURI()` generates SVG metadata on-chain

### `CipherMarket.sol`

- Listing lifecycle: `createListing` → `Active` → `Sold`/`Cancelled`
- Encrypted bids: `placeBid` stores ciphertext and allows the seller to decrypt
- Acceptance: `acceptBid` records the clear price after off-chain decryption
- Settlement: `settleAcceptedBid` finalizes payment and transfers the NFT
- Proceeds: `withdrawProceeds`

### `FHECounter.sol`

- Minimal FHE example contract kept for reference and testing

## Repository Structure

```
contracts/          # Solidity contracts
  CipherNFT.sol
  CipherMarket.sol
  FHECounter.sol

deploy/             # Hardhat deploy scripts

tasks/              # Hardhat tasks

frontend/           # React + Vite frontend (no Tailwind)

test/               # Contract tests

docs/               # Zama documentation references
```

## Prerequisites

- **Node.js** 20+
- **npm**
- **Sepolia ETH** for testing real deployments

## Installation

```bash
npm install
```

## Environment Configuration (Deployment Only)

Create or update `.env` in the repo root:

```bash
# PRIVATE_KEY must be your deployer key (without 0x prefix)
# Do not use mnemonics
PRIVATE_KEY=...
INFURA_API_KEY=...
ETHERSCAN_API_KEY=... # optional
```

## Compile and Test

```bash
npm run compile
npm run test
```

## Local Development

1. Start a local FHEVM-ready node:
   ```bash
   npx hardhat node
   ```
2. Deploy to the local network:
   ```bash
   npx hardhat deploy --network localhost
   ```

## Deploy to Sepolia

1. Run tasks and tests locally until they pass.
2. Deploy with your private key:
   ```bash
   npx hardhat deploy --network sepolia
   ```
3. (Optional) Verify:
   ```bash
   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
   ```

## Frontend Usage

```bash
cd frontend
npm install
npm run dev
```

Notes:
- The frontend reads via **Viem** and writes via **Ethers**.
- Contract ABIs are copied from `deployments/sepolia` into the frontend.
- The frontend does not rely on environment variables or local storage.

## User Flow (End-to-End)

1. **Mint** a Cipher NFT (one per address).
2. **List** your NFT with a fixed price.
3. **Receive encrypted bids** from other users.
4. **Decrypt bids** (seller only) via Zama relayer.
5. **Accept a bid** by posting the decrypted clear price.
6. **Bidder settles** payment, NFT transfers to bidder.
7. **Seller withdraws** proceeds.

## Design Notes and Limitations

- Encrypted bid values are stored on-chain, but the decrypted clear price is provided
  by the seller when accepting a bid.
- The contract does not validate the clear price against the ciphertext.
- Bids are not escrowed; the accepted bidder pays at settlement time.

## Future Roadmap

- **Bid verification**: cryptographic checks that the accepted clear price matches the ciphertext.
- **Batch decryption UX**: seller-side tools for reviewing multiple bids quickly.
- **Royalties**: optional creator royalties and secondary sale fees.
- **Listing enhancements**: timed auctions, reserve prices, and partial fills.
- **Indexing**: lightweight indexing for faster listing and bid discovery.
- **Metadata upgrades**: richer on-chain SVG traits and trait-based filtering.
- **Marketplace analytics**: privacy-aware metrics for sellers and buyers.

## License

BSD-3-Clause-Clear. See `LICENSE`.
