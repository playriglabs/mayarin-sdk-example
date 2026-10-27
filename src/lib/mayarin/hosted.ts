import { currency, getClient, isMock, merchant, publicImageUrl, toMoney } from "./client";
import type { Order } from "../types";

/** Hosted checkout (modal / new tab). Returns the Mayarin checkout URL. */
export async function createCheckout(order: Order): Promise<{ url: string }> {
  if (isMock) return { url: `/mock-pay/${order.id}` };
  const imageUrl = publicImageUrl(order.gameImage);
  const checkout = await getClient().commerce.carts.checkout(
    {
      merchant,
      currency,
      lines: [
        {
          name: order.productName,
          unitPrice: toMoney(order.price),
          quantity: 1,
          // Shown in the hosted checkout UI. Needs a public PUBLIC_SITE_URL.
          imageUrl,
        },
      ],
      merchantReference: order.id,
      // String map echoed back in intents and webhooks.
      metadata: orderMetadata(order, imageUrl),
    },
    { idempotencyKey: order.id },
  );
  return { url: checkout.url };
}

/** String map echoed back in intents and webhooks. */
export const orderMetadata = (order: Order, imageUrl?: string): Record<string, string> => ({
  orderId: order.id,
  game: order.gameName,
  product: order.productName,
  ...(imageUrl ? { imageUrl } : {}),
  userId: order.account.userId,
  ...(order.account.zoneId ? { zoneId: order.account.zoneId } : {}),
});
