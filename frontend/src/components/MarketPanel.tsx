import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChainId } from 'wagmi';
import { Contract, ethers } from 'ethers';

import '../styles/Panel.css';
import { CIPHER_MARKET_ABI } from '../config/contracts';
import { publicClient } from '../lib/publicClient';
import { SEPOLIA_CHAIN_ID } from '../config/web3';
import { useEthersSigner } from '../hooks/useEthersSigner';

type ListingStatus = 0 | 1 | 2 | 3 | 4;

type Listing = {
  seller: `0x${string}`;
  tokenId: bigint;
  priceWei: bigint;
  status: ListingStatus;
  acceptedBidder: `0x${string}`;
  acceptedPriceWei: bigint;
  createdAt: number;
  updatedAt: number;
};

type Bid = {
  bidder: `0x${string}`;
  encryptedAmount: `0x${string}`;
  createdAt: number;
  cancelled: boolean;
  accepted: boolean;
};

type Props = {
  address?: `0x${string}`;
  nftAddress: `0x${string}` | null;
  marketAddress: `0x${string}` | null;
  zamaInstance: any;
  zamaLoading: boolean;
  zamaError: string | null;
};

function statusLabel(status: ListingStatus): string {
  switch (status) {
    case 1:
      return 'Active';
    case 2:
      return 'Awaiting payment';
    case 3:
      return 'Sold';
    case 4:
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}

export function MarketPanel({ address, nftAddress, marketAddress, zamaInstance }: Props) {
  const chainId = useChainId();
  const signerPromise = useEthersSigner();

  const [listings, setListings] = useState<Array<{ id: bigint; listing: Listing }>>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wrongNetwork = chainId !== SEPOLIA_CHAIN_ID;
  const ready = !!nftAddress && !!marketAddress && !wrongNetwork;

  const refreshListings = useCallback(async () => {
    if (!ready || !marketAddress) return;
    setError(null);

    const count = (await publicClient.readContract({
      address: marketAddress,
      abi: CIPHER_MARKET_ABI,
      functionName: 'listingCount',
    })) as bigint;

    const ids: bigint[] = [];
    for (let i = 1n; i <= count; i++) ids.push(i);

    const fetched = await Promise.all(
      ids.map(async (id) => {
        const l = (await publicClient.readContract({
          address: marketAddress,
          abi: CIPHER_MARKET_ABI,
          functionName: 'getListing',
          args: [id],
        })) as Listing;
        return { id, listing: l };
      }),
    );

    setListings(fetched);
  }, [ready, marketAddress]);

  useEffect(() => {
    void refreshListings();
  }, [refreshListings]);

  const visibleListings = useMemo(() => {
    return listings
      .filter(({ listing }) => listing.status === 1 || listing.status === 2)
      .sort((a, b) => Number(a.id - b.id));
  }, [listings]);

  const buyNow = useCallback(
    async (listingId: bigint, priceWei: bigint) => {
      if (!ready || !marketAddress || !signerPromise) return;
      setBusy(`buy:${listingId.toString()}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');
        const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);
        const tx = await market.buyNow(listingId, { value: priceWei });
        await tx.wait();
        await refreshListings();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Buy failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, marketAddress, signerPromise, refreshListings],
  );

  const cancelListing = useCallback(
    async (listingId: bigint) => {
      if (!ready || !marketAddress || !signerPromise) return;
      setBusy(`cancel:${listingId.toString()}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');
        const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);
        const tx = await market.cancelListing(listingId);
        await tx.wait();
        await refreshListings();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Cancel failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, marketAddress, signerPromise, refreshListings],
  );

  const settle = useCallback(
    async (listingId: bigint, priceWei: bigint) => {
      if (!ready || !marketAddress || !signerPromise) return;
      setBusy(`settle:${listingId.toString()}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');
        const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);
        const tx = await market.settleAcceptedBid(listingId, { value: priceWei });
        await tx.wait();
        await refreshListings();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Settle failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, marketAddress, signerPromise, refreshListings],
  );

  const [bidAmountByListingId, setBidAmountByListingId] = useState<Record<string, string>>({});

  const placeBid = useCallback(
    async (listingId: bigint) => {
      if (!ready || !marketAddress || !address || !signerPromise) return;
      if (!zamaInstance) {
        setError('Encryption service not ready');
        return;
      }

      setBusy(`bid:${listingId.toString()}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');

        const bidEth = (bidAmountByListingId[listingId.toString()] ?? '').trim();
        if (!bidEth) throw new Error('Enter a bid amount in ETH');
        const amountWei = ethers.parseEther(bidEth);

        const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);
        const encrypted = await zamaInstance.createEncryptedInput(marketAddress, address).add64(amountWei).encrypt();

        const tx = await market.placeBid(listingId, encrypted.handles[0], encrypted.inputProof);
        await tx.wait();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Bid failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, marketAddress, address, signerPromise, zamaInstance, bidAmountByListingId],
  );

  const [bidsByListingId, setBidsByListingId] = useState<Record<string, Bid[]>>({});
  const [decryptedByHandle, setDecryptedByHandle] = useState<Record<string, string>>({});

  const loadBids = useCallback(
    async (listingId: bigint) => {
      if (!ready || !marketAddress) return;

      const count = (await publicClient.readContract({
        address: marketAddress,
        abi: CIPHER_MARKET_ABI,
        functionName: 'getBidCount',
        args: [listingId],
      })) as bigint;

      const bids: Bid[] = [];
      for (let i = 0n; i < count; i++) {
        const bid = (await publicClient.readContract({
          address: marketAddress,
          abi: CIPHER_MARKET_ABI,
          functionName: 'getBid',
          args: [listingId, i],
        })) as Bid;
        bids.push(bid);
      }

      setBidsByListingId((prev) => ({ ...prev, [listingId.toString()]: bids }));
    },
    [ready, marketAddress],
  );

  const decryptBid = useCallback(
    async (handle: `0x${string}`) => {
      if (!ready || !marketAddress || !address || !signerPromise) return;
      if (!zamaInstance) {
        setError('Encryption service not ready');
        return;
      }

      setBusy(`decrypt:${handle}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');

        const keypair = zamaInstance.generateKeypair();
        const handleContractPairs = [{ handle, contractAddress: marketAddress }];
        const startTimeStamp = Math.floor(Date.now() / 1000).toString();
        const durationDays = '1';
        const contractAddresses = [marketAddress];
        const eip712 = zamaInstance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);

        const signature = await signer.signTypedData(
          eip712.domain,
          { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          eip712.message,
        );

        const result = await zamaInstance.userDecrypt(
          handleContractPairs,
          keypair.privateKey,
          keypair.publicKey,
          signature.replace('0x', ''),
          contractAddresses,
          address,
          startTimeStamp,
          durationDays,
        );

        const clear = result[handle];
        setDecryptedByHandle((prev) => ({ ...prev, [handle]: clear?.toString?.() ?? String(clear) }));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Decrypt failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, marketAddress, address, signerPromise, zamaInstance],
  );

  const acceptBid = useCallback(
    async (listingId: bigint, bidIndex: number, clearPriceEth: string) => {
      if (!ready || !marketAddress || !signerPromise) return;
      setBusy(`accept:${listingId.toString()}:${bidIndex}`);
      setError(null);
      try {
        const signer = await signerPromise;
        if (!signer) throw new Error('Wallet signer not available');

        const clearWei = ethers.parseEther(clearPriceEth);
        const market = new Contract(marketAddress, CIPHER_MARKET_ABI, signer);
        const tx = await market.acceptBid(listingId, bidIndex, clearWei);
        await tx.wait();
        await refreshListings();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Accept failed');
      } finally {
        setBusy(null);
      }
    },
    [ready, marketAddress, signerPromise, refreshListings],
  );

  const [acceptPriceByKey, setAcceptPriceByKey] = useState<Record<string, string>>({});

  if (wrongNetwork) {
    return (
      <section className="panel">
        <h3 className="panel-title">Market</h3>
        <div className="hint error">Switch your wallet network to Sepolia.</div>
      </section>
    );
  }

  if (!nftAddress || !marketAddress) {
    return (
      <section className="panel">
        <h3 className="panel-title">Market</h3>
        <div className="hint error">Set both contract addresses first.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Market</h3>
        <div className="actions">
          <button className="button secondary" onClick={() => void refreshListings()} disabled={!!busy}>
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      {visibleListings.length === 0 ? (
        <div className="hint">No active listings found.</div>
      ) : (
        <div className="listing-grid">
          {visibleListings.map(({ id, listing }) => {
            const isSeller = address && listing.seller.toLowerCase() === address.toLowerCase();
            const isAcceptedBidder = address && listing.acceptedBidder.toLowerCase() === address.toLowerCase();
            const key = id.toString();
            const bids = bidsByListingId[key] ?? null;

            return (
              <div key={id.toString()} className="listing-card">
                <div className="listing-top">
                  <div>
                    <div className="listing-title">Listing #{id.toString()}</div>
                    <div className="hint">
                      Token #{listing.tokenId.toString()} • Seller {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
                    </div>
                  </div>
                  <div className="badge">{statusLabel(listing.status)}</div>
                </div>

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div className="stat">
                    <div className="stat-label">Buy now</div>
                    <div className="stat-value">{ethers.formatEther(listing.priceWei)} ETH</div>
                  </div>
                  <div className="stat">
                    {listing.status === 1 && !isSeller && (
                      <button
                        className="button"
                        onClick={() => void buyNow(id, listing.priceWei)}
                        disabled={!!busy || !address}
                      >
                        {busy === `buy:${id.toString()}` ? 'Buying…' : 'Buy now'}
                      </button>
                    )}
                    {listing.status === 1 && isSeller && (
                      <button
                        className="button secondary"
                        onClick={() => void cancelListing(id)}
                        disabled={!!busy}
                      >
                        {busy === `cancel:${id.toString()}` ? 'Cancelling…' : 'Cancel listing'}
                      </button>
                    )}
                    {listing.status === 2 && isAcceptedBidder && (
                      <button
                        className="button"
                        onClick={() => void settle(id, listing.acceptedPriceWei)}
                        disabled={!!busy}
                      >
                        {busy === `settle:${id.toString()}` ? 'Settling…' : `Settle (${ethers.formatEther(listing.acceptedPriceWei)} ETH)`}
                      </button>
                    )}
                  </div>
                </div>

                {listing.status === 1 && !isSeller && (
                  <div className="row" style={{ marginTop: '0.75rem' }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label className="label">Encrypted bid amount (ETH)</label>
                      <input
                        className="input"
                        value={bidAmountByListingId[key] ?? ''}
                        onChange={(e) => setBidAmountByListingId((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder="0.015"
                        inputMode="decimal"
                      />
                    </div>
                    <button className="button" onClick={() => void placeBid(id)} disabled={!!busy || !address}>
                      {busy === `bid:${id.toString()}` ? 'Submitting…' : 'Place bid'}
                    </button>
                  </div>
                )}

                {listing.status === 2 && (
                  <div className="alert">
                    Accepted bidder: {listing.acceptedBidder.slice(0, 6)}…{listing.acceptedBidder.slice(-4)} • Price{' '}
                    {ethers.formatEther(listing.acceptedPriceWei)} ETH
                  </div>
                )}

                <div className="divider" />

                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h4 className="section-title" style={{ margin: 0 }}>
                    Bids
                  </h4>
                  <button className="button secondary" onClick={() => void loadBids(id)} disabled={!!busy}>
                    Load bids
                  </button>
                </div>

                {!bids ? (
                  <div className="hint">Click "Load bids" to fetch bids for this listing.</div>
                ) : bids.length === 0 ? (
                  <div className="hint">No bids yet.</div>
                ) : (
                  <div className="bid-list">
                    {bids.map((bid, i) => {
                      const handle = bid.encryptedAmount;
                      const decrypted = decryptedByHandle[handle];
                      const acceptKey = `${id.toString()}:${i}`;

                      return (
                        <div key={`${handle}:${i}`} className="bid-row">
                          <div className="bid-meta">
                            <div className="bid-bidder">
                              {bid.bidder.slice(0, 6)}…{bid.bidder.slice(-4)}
                              {bid.cancelled ? ' • cancelled' : ''}
                              {bid.accepted ? ' • accepted' : ''}
                            </div>
                            <div className="hint mono">handle: {handle}</div>
                            {decrypted && <div className="bid-clear">Clear: {ethers.formatEther(BigInt(decrypted))} ETH</div>}
                          </div>

                          <div className="bid-actions">
                            {isSeller && (
                              <button
                                className="button secondary"
                                onClick={() => void decryptBid(handle)}
                                disabled={!!busy}
                              >
                                {busy === `decrypt:${handle}` ? 'Decrypting…' : 'Decrypt'}
                              </button>
                            )}

                            {isSeller && listing.status === 1 && !bid.cancelled && !bid.accepted && (
                              <div className="accept-box">
                                <input
                                  className="input"
                                  value={acceptPriceByKey[acceptKey] ?? ''}
                                  onChange={(e) =>
                                    setAcceptPriceByKey((prev) => ({ ...prev, [acceptKey]: e.target.value }))
                                  }
                                  placeholder="Clear price ETH"
                                  inputMode="decimal"
                                />
                                <button
                                  className="button"
                                  onClick={() => void acceptBid(id, i, (acceptPriceByKey[acceptKey] ?? '').trim())}
                                  disabled={!!busy || !(acceptPriceByKey[acceptKey] ?? '').trim()}
                                >
                                  {busy === `accept:${id.toString()}:${i}` ? 'Accepting…' : 'Accept'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
