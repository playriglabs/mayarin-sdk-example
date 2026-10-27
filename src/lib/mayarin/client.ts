import { createMayarin, isMayarinApiError, validationIssues, type AssetCode, type MayarinClient } from "@mayarin/sdk";

const env = import.meta.env;

const secretKey: string | undefined = env.MAYARIN_SECRET_KEY;

/** No key configured: hosted checkout falls back to a local simulated payment page. */
export const isMock = !secretKey;

export const apiUrl: string = env.MAYARIN_API_URL ?? "https://api.mayarin.xyz";
export const siteUrl: string = env.PUBLIC_SITE_URL ?? "http://localhost:4321";
/** Testnet-only features (simulated deposits) are offered only against a testnet API. */
export const isTestnet = apiUrl.includes("testnet");

let client: MayarinClient | undefined;
export const getClient = () => (client ??= createMayarin({ baseUrl: apiUrl, secretKey: secretKey! }));

export const merchant = {
  id: env.MAYARIN_MERCHANT_ID ?? "gamingfun",
  name: env.MAYARIN_MERCHANT_NAME ?? "GamingFun",
  city: "Jakarta",
  countryCode: "ID",
};

// Catalog prices are IDR, so the billing currency is fixed (IDR has 2 decimals).
const currency: AssetCode = "IDR";
export const toMoney = (price: number) => ({ amount: price.toFixed(2), asset: currency });
export { currency };

/** Mayarin rejects non-public image URLs (e.g. localhost) with "Invalid URL", so skip them in local dev. */
export function publicImageUrl(path: string): string | undefined {
  const { hostname, href } = new URL(path, siteUrl);
  return /^(localhost|127\.|10\.|192\.168\.|\[?::1)/.test(hostname) || hostname.endsWith(".local")
    ? undefined
    : href;
}

/** What went wrong, in one line: field-level validation issues when the API gave them. */
export function describeError(err: unknown): string {
  if (isMayarinApiError(err)) {
    const issues = validationIssues(err);
    return issues.length ? issues.map((i) => `${i.path}: ${i.message}`).join("; ") : `${err.code} ${err.message}${causeOf(err)}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Network-level cause behind a NETWORK_ERROR (e.g. ECONNRESET, UND_ERR_CONNECT_TIMEOUT), for logs. */
export const causeOf = (err: unknown): string =>
  err instanceof Error && err.cause ? ` (${(err.cause as { code?: string }).code ?? String(err.cause)})` : "";

/**
 * Retry calls the SDK marks `retryable` (dropped connection, 5xx). Safe for our writes because
 * each carries an idempotency key, so a retry reuses the first request's result.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!(isMayarinApiError(err) && err.retryable) || i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}
