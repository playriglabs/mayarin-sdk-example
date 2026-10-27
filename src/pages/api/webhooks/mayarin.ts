import type { APIRoute } from "astro";
import { MayarinWebhookError } from "@mayarin/sdk";
import { constructWebhook, fetchIntentStatus } from "../../../lib/mayarin";
import { getOrder, updateOrder } from "../../../lib/orders";

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  let event;
  try {
    event = await constructWebhook({
      payload: raw,
      signature: request.headers.get("webhook-signature") ?? "",
      secret: import.meta.env.MAYARIN_WEBHOOK_SECRET ?? "",
    });
  } catch (err) {
    if (err instanceof MayarinWebhookError) return new Response(err.message, { status: 401 });
    throw err;
  }

  // Webhook = signal only. Re-read intent from Mayarin as source of truth.
  const result = await fetchIntentStatus(event.data.paymentIntentId);
  if (result?.orderId && result.status) {
    const order = await getOrder(result.orderId);
    // A cancelled attempt (rail changed) must not touch the order's current intent.
    const stale = order?.intentId && order.intentId !== event.data.paymentIntentId;
    if (order && !stale && order.status === "PENDING") {
      await updateOrder(order.id, { status: result.status, intentId: event.data.paymentIntentId });
    }
  }
  return new Response("ok");
};
