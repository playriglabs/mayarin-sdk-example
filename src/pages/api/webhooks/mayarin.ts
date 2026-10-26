import type { APIRoute } from "astro";
import { MayarinWebhookError } from "@mayarin/sdk";
import { constructWebhook, fetchIntentStatus } from "../../../lib/mayarin";
import { getOrder, updateOrder } from "../../../lib/orders";

interface MayarinWebhookEvent {
  id: string;
  type: "payment.created" | "payment.state_changed" | "payment.failed";
  occurredAt: string;
  data: { paymentIntentId: string; state: string; metadata: Record<string, string> };
}

export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  let event: MayarinWebhookEvent;
  try {
    event = await constructWebhook<MayarinWebhookEvent>({
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
    if (order && order.status === "PENDING") {
      await updateOrder(order.id, { status: result.status, intentId: event.data.paymentIntentId });
    }
  }
  return new Response("ok");
};
