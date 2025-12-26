import { createPublicClient, http } from 'viem';
import { sepolia } from 'viem/chains';
import { SEPOLIA_RPC_URL } from '../config/web3';

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(SEPOLIA_RPC_URL),
});

