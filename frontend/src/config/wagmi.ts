import { createConfig, createStorage, cookieStorage, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { sepolia } from 'wagmi/chains';

import { SEPOLIA_RPC_URL } from './web3';

export const config = createConfig({
  chains: [sepolia],
  connectors: [injected()],
  transports: {
    [sepolia.id]: http(SEPOLIA_RPC_URL),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: false,
});
