export const DEFAULT_CIPHER_NFT_ADDRESS: `0x${string}` | null = "0xD25706FeDdFDEc60f2bf0BE07504B19dC3e93936";
export const DEFAULT_CIPHER_MARKET_ADDRESS: `0x${string}` | null = "0x6f7d43e107316a04aB65DC61cb86B8E87a13920F";

export const CIPHER_NFT_ABI = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'hasMinted',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'tokensOfOwner',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getApproved',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ type: 'string' }],
  },
] as const;

export const CIPHER_MARKET_ABI = [
  {
    type: 'constructor',
    inputs: [{ name: 'nftAddress', type: 'address' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'nft',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  { type: 'function', name: 'listingCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'listingIdByTokenId',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'proceeds',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getListing',
    stateMutability: 'view',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'seller', type: 'address' },
          { name: 'tokenId', type: 'uint256' },
          { name: 'priceWei', type: 'uint256' },
          { name: 'status', type: 'uint8' },
          { name: 'acceptedBidder', type: 'address' },
          { name: 'acceptedPriceWei', type: 'uint256' },
          { name: 'createdAt', type: 'uint40' },
          { name: 'updatedAt', type: 'uint40' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'getBidCount',
    stateMutability: 'view',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getBid',
    stateMutability: 'view',
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'bidId', type: 'uint256' },
    ],
    outputs: [
      {
        type: 'tuple',
        components: [
          { name: 'bidder', type: 'address' },
          { name: 'encryptedAmount', type: 'bytes32' },
          { name: 'createdAt', type: 'uint40' },
          { name: 'cancelled', type: 'bool' },
          { name: 'accepted', type: 'bool' },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'createListing',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'priceWei', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'cancelListing',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'buyNow',
    stateMutability: 'payable',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'placeBid',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'acceptBid',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'listingId', type: 'uint256' },
      { name: 'bidId', type: 'uint256' },
      { name: 'clearPriceWei', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'settleAcceptedBid',
    stateMutability: 'payable',
    inputs: [{ name: 'listingId', type: 'uint256' }],
    outputs: [],
  },
  { type: 'function', name: 'withdrawProceeds', stateMutability: 'nonpayable', inputs: [], outputs: [] },
] as const;

