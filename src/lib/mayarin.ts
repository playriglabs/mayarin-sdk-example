import { createMayarin, type MayarinClient } from "@mayarin/sdk";

type Asset = Parameters<
  MayarinClient["commerce"]["carts"]["checkout"]
>[0]["currency"];
import type { Order, OrderStatus } from "./types";

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
const currency = (env.MAYARIN_CURRENCY ?? "IDR") as Asset;

/** Create hosted checkout for an order. Returns Mayarin intent id + checkout URL. */
export async function createCheckout(
  order: Order,
): Promise<{ intentId?: string; url: string }> {
  if (isMock) return { url: `/mock-pay/${order.id}` };
  const checkout = await getClient().commerce.carts.checkout(
    {
      merchant,
      currency,
      lines: [
        {
          name: `${order.productName}`,
          unitPrice: { amount: order.price.toFixed(2), asset: currency },
          quantity: 1,
        },
      ],
      merchantReference: order.id,
      // String map echoed back in intents and webhooks. Image must be a public absolute URL.
      metadata: {
        orderId: order.id,
        game: order.gameName,
        product: order.productName,
        imageUrl: new URL(order.productImage, siteUrl).href,
        userId: order.account.userId,
        ...(order.account.zoneId ? { zoneId: order.account.zoneId } : {}),
      },
    },
    { idempotencyKey: order.id },
  );
  return { url: checkout.url };
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
