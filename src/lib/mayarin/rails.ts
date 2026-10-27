import { chainLabel, type ChainId, type OnChainAssetCode } from "@mayarin/sdk";
import { getClient } from "./client";

export interface RailOption {
  chain: ChainId;
  label: string;
  assets: OnChainAssetCode[];
}

const TTL_MS = 5 * 60_000;
let cache: { at: number; rails: RailOption[] } | undefined;

/** Rails the merchant can be paid on, grouped by chain. `commerce.rails()` is what `createIntent` validates against. */
export async function getRails(): Promise<RailOption[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rails;
  const { rails } = await getClient().commerce.rails();
  const byChain = new Map<ChainId, RailOption>();
  for (const r of rails) {
    const option = byChain.get(r.chain) ?? { chain: r.chain, label: chainLabel(r.chain), assets: [] };
    option.assets.push(r.asset as OnChainAssetCode);
    byChain.set(r.chain, option);
  }
  cache = { at: Date.now(), rails: [...byChain.values()] };
  return cache.rails;
}

export async function isOfferedRail(chain: unknown, asset: unknown) {
  return (await getRails()).some((r) => r.chain === chain && (r.assets as unknown[]).includes(asset));
}
