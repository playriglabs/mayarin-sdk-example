import { createMayarin, type MayarinClient } from "@mayarin/sdk";

type Asset = Parameters<
  MayarinClient["commerce"]["carts"]["checkout"]
>[0]["currency"];
import type { Asset as HeadlessAsset, Chain, Order, OrderStatus } from "./types";

const env = import.meta.env;

const secretKey: string | undefined = env.MAYARIN_SECRET_KEY;

/** No key configured: checkout falls back to a local simulated payment page. */
export const isMock = !secretKey;

export const siteUrl: string = env.PUBLIC_SITE_URL ?? "http://localhost:4321";

let client: MayarinClient | undefined;
const getClient = () =>
  (client ??= createMayarin({
    baseUrl: env.MAYARIN_API_URL ?? "https://api.mayarin.xyz",
    secretKey: secretKey!,
  }));

const merchant = {
  id: env.MAYARIN_MERCHANT_ID ?? "gamingfun",
  name: env.MAYARIN_MERCHANT_NAME ?? "GamingFun",
  city: "Jakarta",
  countryCode: "ID",
};
// Catalog prices are IDR, so the billing currency is fixed (IDR has 2 decimals).
const currency: Asset = "IDR";
const toMoney = (price: number) => ({ amount: price.toFixed(2), asset: currency });

/** Mayarin rejects non-public image URLs (e.g. localhost) with "Invalid URL", so skip them in local dev. */
function publicImageUrl(path: string): string | undefined {
  const { hostname, href } = new URL(path, siteUrl);
  return /^(localhost|127\.|10\.|192\.168\.|\[?::1)/.test(hostname) || hostname.endsWith(".local")
    ? undefined
    : href;
}

/** Create hosted checkout for an order. Returns Mayarin intent id + checkout URL. */
export async function createCheckout(
  order: Order,
): Promise<{ intentId?: string; url: string }> {
  if (isMock) return { url: `/mock-pay/${order.id}` };
  const imageUrl = publicImageUrl(order.gameImage);
  const checkout = await getClient().commerce.carts.checkout(
    {
      merchant,
      currency,
      lines: [
        {
          name: `${order.productName}`,
          unitPrice: toMoney(order.price),
          quantity: 1,
          // Shown in the hosted checkout UI. Needs a public PUBLIC_SITE_URL.
          imageUrl,
        },
      ],
      merchantReference: order.id,
      // String map echoed back in intents and webhooks. Image must be a public absolute URL.
      metadata: {
        orderId: order.id,
        game: order.gameName,
        product: order.productName,
        ...(imageUrl ? { imageUrl } : {}),
        userId: order.account.userId,
        ...(order.account.zoneId ? { zoneId: order.account.zoneId } : {}),
      },
    },
    { idempotencyKey: order.id },
  );
  return { url: checkout.url };
}

/**
 * Headless checkout: no hosted page. Create + confirm a deposit-match intent on the backend;
 * confirming locks the price and allocates a unique deposit address.
 */
export async function createHeadlessPayment(order: Order, rail: { chain: Chain; asset: HeadlessAsset }) {
  const payment = getClient().payment;
  const intent = await payment.createIntent(
    {
      merchant,
      amount: toMoney(order.price),
      payment: rail,
      executionPath: "deposit-match",
      merchantReference: order.id,
      metadata: {
        orderId: order.id,
        game: order.gameName,
        product: order.productName,
        userId: order.account.userId,
        ...(order.account.zoneId ? { zoneId: order.account.zoneId } : {}),
      },
    },
    { idempotencyKey: order.id },
  );
  await payment.confirmIntent(intent.id, { idempotencyKey: `${order.id}:confirm` });
  return intent.id;
}

/** Client-safe view of a headless payment. Never exposes checkoutUrl / payerToken. */
export async function getHeadlessPayment(intentId: string, expectedOrderId: string) {
  const { paymentIntent, deposit } = await getClient().payment.get(intentId);
  if (paymentIntent.merchant.id !== merchant.id || paymentIntent.merchantReference !== expectedOrderId) return undefined;
  return {
    status: paymentIntent.status,
    expiresAt: paymentIntent.expiresAt,
    failureReason: paymentIntent.failureReason,
    deposit: deposit && {
      address: deposit.address,
      chain: deposit.chain,
      asset: deposit.asset,
      amount: deposit.amount.formatted, // machine-readable, not the localized `display`
      received: deposit.received.formatted,
      uri: deposit.uri,
    },
  };
}

const FINAL: Record<string, OrderStatus> = {
  COMPLETED: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
};

/** Source of truth: re-read intent from Mayarin and map to order status. */
export async function fetchIntentStatus(
  intentId: string,
  expectedOrderId?: string,
) {
  const { paymentIntent } = await getClient().payment.get(intentId);
  if (paymentIntent.merchant.id !== merchant.id) return undefined;
  if (expectedOrderId && paymentIntent.merchantReference !== expectedOrderId)
    return undefined;
  return {
    orderId: paymentIntent.merchantReference ?? undefined,
    status: FINAL[paymentIntent.status] as OrderStatus | undefined,
  };
}

export { constructWebhook } from "@mayarin/sdk";
