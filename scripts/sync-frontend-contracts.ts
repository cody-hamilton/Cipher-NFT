import * as fs from "node:fs";
import * as path from "node:path";

type DeploymentJson = {
  address: string;
  abi: unknown;
};

function readDeployment(deploymentsDir: string, name: string): DeploymentJson {
  const p = path.join(deploymentsDir, `${name}.json`);
  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw) as DeploymentJson;
  if (!parsed.address || !parsed.abi) {
    throw new Error(`Invalid deployment file: ${p}`);
  }
  return parsed;
}

function toTsLiteral(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function main() {
  const repoRoot = process.cwd();
  const deploymentsDir = path.join(repoRoot, "deployments", "sepolia");
  const frontendContractsTs = path.join(repoRoot, "frontend", "src", "config", "contracts.ts");

  const nft = readDeployment(deploymentsDir, "CipherNFT");
  const market = readDeployment(deploymentsDir, "CipherMarket");

  const contents = `export const DEFAULT_CIPHER_NFT_ADDRESS: \\`0x\\${string}\\` | null = ${JSON.stringify(
    nft.address,
  )} as const;
export const DEFAULT_CIPHER_MARKET_ADDRESS: \\`0x\\${string}\\` | null = ${JSON.stringify(market.address)} as const;

export const CIPHER_NFT_ABI = ${toTsLiteral(nft.abi)} as const;
export const CIPHER_MARKET_ABI = ${toTsLiteral(market.abi)} as const;
`;

  fs.writeFileSync(frontendContractsTs, contents, "utf8");
  console.log(`Wrote ${path.relative(repoRoot, frontendContractsTs)}`);
}

main();

