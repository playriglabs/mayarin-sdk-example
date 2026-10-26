import type { APIRoute } from "astro";
import { getOrder, updateOrder } from "../../../lib/orders";
import { fetchIntentStatus } from "../../../lib/mayarin";

// Intent id lives in the hosted checkout URL: /checkout/pay/pi_XXXX?t=...
const intentIdOf = (url?: string) => url?.match(/\/(pi_[A-Za-z0-9]+)/)?.[1];

export const GET: APIRoute = async ({ params }) => {
  let order = await getOrder(params.id!);
  if (!order) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  // Webhook may not reach us (local dev). Re-read intent from Mayarin as source of truth.
  const intentId = order.intentId ?? intentIdOf(order.checkoutUrl);
  if (order.status === "PENDING" && !order.mock && intentId) {
    try {
      const result = await fetchIntentStatus(intentId, order.id);
      if (result?.status) order = (await updateOrder(order.id, { status: result.status, intentId })) ?? order;
    } catch (err) {
      console.error("intent status check failed", err);
    }
  }

  const { id, gameName, productName, price, status, createdAt, mock, checkoutUrl } = order;
  return new Response(JSON.stringify({ id, gameName, productName, price, status, createdAt, mock, checkoutUrl }), {
    headers: { "content-type": "application/json" },
  });
};
