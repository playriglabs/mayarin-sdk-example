import type { Asset, Chain } from "./types";

/** Rails offered at headless checkout. Verified against the Mayarin testnet (deposit-match). */
export const HEADLESS_RAILS: { chain: Chain; label: string; assets: Asset[] }[] = [
  { chain: "ethereum-sepolia", label: "Ethereum Sepolia", assets: ["USDC", "ETH"] },
  { chain: "base-sepolia", label: "Base Sepolia", assets: ["USDC", "ETH"] },
  { chain: "arbitrum-sepolia", label: "Arbitrum Sepolia", assets: ["USDC"] },
  { chain: "polygon-amoy", label: "Polygon Amoy", assets: ["USDC"] },
  { chain: "bsc-testnet", label: "BNB Chain Testnet", assets: ["USDC"] },
  { chain: "arc-testnet", label: "Arc Testnet", assets: ["USDC"] },
];

export const isValidRail = (chain: unknown, asset: unknown) =>
  HEADLESS_RAILS.some((r) => r.chain === chain && (r.assets as unknown[]).includes(asset));

export const chainLabel = (chain: string) => HEADLESS_RAILS.find((r) => r.chain === chain)?.label ?? chain;
