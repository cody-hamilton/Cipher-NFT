import '../styles/Panel.css';

type Props = {
  nftAddressInput: string;
  marketAddressInput: string;
  nftAddress: `0x${string}` | null;
  marketAddress: `0x${string}` | null;
  onChangeNftAddress: (value: string) => void;
  onChangeMarketAddress: (value: string) => void;
};

export function ContractsPanel({
  nftAddressInput,
  marketAddressInput,
  nftAddress,
  marketAddress,
  onChangeNftAddress,
  onChangeMarketAddress,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h3 className="panel-title">Contracts</h3>
        <p className="panel-subtitle">Paste Sepolia contract addresses (no local storage is used).</p>
      </div>

      <div className="grid">
        <div className="field">
          <label className="label">CipherNFT address</label>
          <input
            className={nftAddress ? 'input' : 'input invalid'}
            value={nftAddressInput}
            onChange={(e) => onChangeNftAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
          />
          {!nftAddress && nftAddressInput.trim() !== '' && <div className="hint error">Invalid address</div>}
        </div>

        <div className="field">
          <label className="label">CipherMarket address</label>
          <input
            className={marketAddress ? 'input' : 'input invalid'}
            value={marketAddressInput}
            onChange={(e) => onChangeMarketAddress(e.target.value)}
            placeholder="0x..."
            spellCheck={false}
          />
          {!marketAddress && marketAddressInput.trim() !== '' && <div className="hint error">Invalid address</div>}
        </div>
      </div>
    </section>
  );
}

