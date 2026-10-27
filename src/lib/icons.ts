import type { ChainId, OnChainAssetCode } from "@mayarin/sdk";

// Testnets reuse their mainnet logo. Anything unmapped falls back to a letter badge in the UI.
const CHAIN_ICONS: Partial<Record<ChainId, string>> = {
  "ethereum-sepolia": "/icons/chains/ethereum.png",
  "base-sepolia": "/icons/chains/base.png",
  "arbitrum-sepolia": "/icons/chains/arbitrum.png",
  "polygon-amoy": "/icons/chains/polygon.png",
  "bsc-testnet": "/icons/chains/bsc.png",
  "solana-devnet": "/icons/chains/solana.png",
  "arc-testnet": "/icons/chains/arc.svg",
  ethereum: "/icons/chains/ethereum.png",
  base: "/icons/chains/base.png",
  arbitrum: "/icons/chains/arbitrum.png",
  polygon: "/icons/chains/polygon.png",
  bsc: "/icons/chains/bsc.png",
};

const ASSET_ICONS: Partial<Record<OnChainAssetCode, string>> = {
  USDC: "/icons/assets/usdc.png",
  EURC: "/icons/assets/eurc.png",
  PYUSD: "/icons/assets/pyusd.png",
  ETH: "/icons/assets/eth.png",
};

export const chainIcon = (chain: string) => CHAIN_ICONS[chain as ChainId];
export const assetIcon = (asset: string) => ASSET_ICONS[asset as OnChainAssetCode];
