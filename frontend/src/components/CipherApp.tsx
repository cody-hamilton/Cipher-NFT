import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

import { Header } from './Header';
import { ContractsPanel } from './ContractsPanel';
import { MintPanel } from './MintPanel';
import { MarketPanel } from './MarketPanel';

import { DEFAULT_CIPHER_MARKET_ADDRESS, DEFAULT_CIPHER_NFT_ADDRESS } from '../config/contracts';
import { normalizeAddress } from '../lib/address';
import { useZamaInstance } from '../hooks/useZamaInstance';
import '../styles/AppShell.css';

type Tab = 'mint' | 'market';

export function CipherApp() {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();

  const [tab, setTab] = useState<Tab>('mint');

  const [nftAddressInput, setNftAddressInput] = useState<string>(DEFAULT_CIPHER_NFT_ADDRESS ?? '');
  const [marketAddressInput, setMarketAddressInput] = useState<string>(DEFAULT_CIPHER_MARKET_ADDRESS ?? '');

  const nftAddress = useMemo(() => normalizeAddress(nftAddressInput), [nftAddressInput]);
  const marketAddress = useMemo(() => normalizeAddress(marketAddressInput), [marketAddressInput]);

  return (
    <div className="app-shell">
      <Header />

      <main className="app-main">
        <div className="app-card">
          <h2 className="app-title">Cipher Market</h2>
          <p className="app-subtitle">
            Free mint (1 per address), list your NFT, and place encrypted bids. Listing sellers can decrypt bid amounts.
          </p>
        </div>

        <ContractsPanel
          nftAddressInput={nftAddressInput}
          marketAddressInput={marketAddressInput}
          onChangeNftAddress={setNftAddressInput}
          onChangeMarketAddress={setMarketAddressInput}
          nftAddress={nftAddress}
          marketAddress={marketAddress}
        />

        <div className="app-tabs">
          <button className={tab === 'mint' ? 'tab active' : 'tab'} onClick={() => setTab('mint')}>
            Mint & My NFTs
          </button>
          <button className={tab === 'market' ? 'tab active' : 'tab'} onClick={() => setTab('market')}>
            Market
          </button>
        </div>

        {tab === 'mint' && (
          <MintPanel
            address={address}
            nftAddress={nftAddress}
            marketAddress={marketAddress}
            zamaLoading={zamaLoading}
            zamaError={zamaError}
            zamaInstance={instance}
          />
        )}

        {tab === 'market' && (
          <MarketPanel
            address={address}
            nftAddress={nftAddress}
            marketAddress={marketAddress}
            zamaLoading={zamaLoading}
            zamaError={zamaError}
            zamaInstance={instance}
          />
        )}
      </main>
    </div>
  );
}

