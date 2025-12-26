import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { Contract, ethers } from 'ethers';

import '../styles/Panel.css';
import { CIPHER_MARKET_ABI, CIPHER_NFT_ABI } from '../config/contracts';
import { publicClient } from '../lib/publicClient';
import { SEPOLIA_CHAIN_ID } from '../config/web3';
import { useEthersSigner } from '../hooks/useEthersSigner';

type Props = {
  address?: `0x${string}`;
  nftAddress: `0x${string}` | null;
  marketAddress: `0x${string}` | null;
  zamaInstance: any;
  zamaLoading: boolean;
  zamaError: string | null;
};

export function MintPanel({ address, nftAddress, marketAddress }: Props) {
  const chainId = useChainId();
  const signerPromise = useEthersSigner();

  const [hasMinted, setHasMinted] = useState<boolean | null>(null);
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [proceedsWei, setProceedsWei] = useState<bigint>(0n);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wrongNetwork = chainId !== SEPOLIA_CHAIN_ID;
  const ready = !!address && !!nftAddress && !!marketAddress && !wrongNetwork;

  const refresh = useCallback(async () => {
    if (!ready || !address || !nftAddress || !marketAddress) return;
    setError(null);

    const [minted, tokens, proceeds] = await Promise.all([
      publicClient.readContract({
        address: nftAddress,
        abi: CIPHER_NFT_ABI,
        functionName: 'hasMinted',
        args: [address],
      }) as Promise<boolean>,
      publicClient.readContract({
        address: nftAddress,
        abi: CIPHER_NFT_ABI,
        functionName: 'tokensOfOwner',
        args: [address],
      }) as Promise<bigint[]>,
      publicClient.readContract({
        address: marketAddress,
        abi: CIPHER_MARKET_ABI,
        functionName: 'proceeds',
        args: [address],
      }) as Promise<bigint>,
    ]);

    setHasMinted(minted);
    setTokenIds(tokens);
    setProceedsWei(proceeds);
  }, [ready, address, nftAddress, marketAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tokenList = useMemo(() => tokenIds.slice().sort((a, b) => Number(a - b)), [tokenIds]);

  const mint = useCallback(async () => {
    if (!ready || !address || !nftAddress || !signerPromise) return;
    setBusy('mint');
    setError(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Wallet signer not available');
      const nft = new Contract(nftAddress, CIPHER_NFT_ABI, signer);
      const tx = await nft.mint();
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mint failed');
    } finally {
      setBusy(null);
    }
  }, [ready, address, nftAddress, signerPromise, refresh]);

  const withdraw = useCallback(async () => {
    if (!ready || !marketAddress || !signerPromise) return;
    setBusy('withdraw');
    setError(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Wallet signer not available');
      const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);
      const tx = await market.withdrawProceeds();
      await tx.wait();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Withdraw failed');
    } finally {
      setBusy(null);
    }
  }, [ready, marketAddress, signerPromise, refresh]);

  const [listPriceByTokenId, setListPriceByTokenId] = useState<Record<string, string>>({});

  const list = useCallback(
    async (tokenId: bigint) => {
      if (!ready || !nftAddress || !marketAddress || !signerPromise) return;
      setBusy(`list:${tokenId.toString()}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');

        const priceEth = (listPriceByTokenId[tokenId.toString()] ?? '').trim();
        if (!priceEth) throw new Error('Enter a price in ETH');
        const priceWei = ethers.parseEther(priceEth);

        const nft = new Contract(nftAddress, CIPHER_NFT_ABI, signer);
        const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);

        const approveTx = await nft.approve(marketAddress, tokenId);
        await approveTx.wait();

        const tx = await market.createListing(tokenId, priceWei);
        await tx.wait();

        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'List failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, nftAddress, marketAddress, signerPromise, listPriceByTokenId, refresh],
  );

  if (!address) {
    return (
      <section className="panel">
        <h3 className="panel-title">Mint & My NFTs</h3>
        <div className="hint">Connect your wallet to continue.</div>
      </section>
    );
  }

  if (wrongNetwork) {
    return (
      <section className="panel">
        <h3 className="panel-title">Mint & My NFTs</h3>
        <div className="hint error">Switch your wallet network to Sepolia.</div>
      </section>
    );
  }

  if (!nftAddress || !marketAddress) {
    return (
      <section className="panel">
        <h3 className="panel-title">Mint & My NFTs</h3>
        <div className="hint error">Set both contract addresses first.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Mint & My NFTs</h3>
        <div className="actions">
          <button className="button secondary" onClick={() => void refresh()} disabled={!!busy}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="row">
        <div className="stat">
          <div className="stat-label">Minted</div>
          <div className="stat-value">{hasMinted === null ? '—' : hasMinted ? 'Yes' : 'No'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Proceeds</div>
          <div className="stat-value">{ethers.formatEther(proceedsWei)} ETH</div>
        </div>
        <div className="stat">
          <button className="button" onClick={() => void withdraw()} disabled={!!busy || proceedsWei === 0n}>
            {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw'}
          </button>
        </div>
      </div>

      <div className="row">
        <button className="button" onClick={() => void mint()} disabled={!!busy || hasMinted === true}>
          {hasMinted === true ? 'Already minted' : busy === 'mint' ? 'Minting…' : 'Mint free NFT'}
        </button>
      </div>

      <div className="divider" />

      <h4 className="section-title">My token IDs</h4>
      {tokenList.length === 0 ? (
        <div className="hint">No tokens found for this wallet.</div>
      ) : (
        <div className="token-grid">
          {tokenList.map((tokenId) => (
            <div key={tokenId.toString()} className="token-card">
              <div className="token-id">#{tokenId.toString()}</div>
              <div className="field" style={{ marginTop: '0.75rem' }}>
                <label className="label">List price (ETH)</label>
                <input
                  className="input"
                  value={listPriceByTokenId[tokenId.toString()] ?? ''}
                  onChange={(e) =>
                    setListPriceByTokenId((prev) => ({ ...prev, [tokenId.toString()]: e.target.value }))
                  }
                  placeholder="0.01"
                  inputMode="decimal"
                />
              </div>
              <button
                className="button"
                onClick={() => void list(tokenId)}
                disabled={!!busy}
                style={{ marginTop: '0.75rem' }}
              >
                {busy === `list:${tokenId.toString()}` ? 'Listing…' : 'List'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

