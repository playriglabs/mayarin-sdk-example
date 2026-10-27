import type { APIRoute } from "astro";
import { HEADLESS_RAILS, isValidRail } from "../../../lib/rails";
import { getOrder, updateOrder } from "../../../lib/orders";
import { createHeadlessPayment, fetchIntentStatus, getHeadlessPayment } from "../../../lib/mayarin";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const GET: APIRoute = async ({ params }) => {
  const order = await getOrder(params.id!);
  if (!order) return json({ error: "not found" }, 404);
  const summary = { orderId: order.id, productName: order.productName, gameName: order.gameName, price: order.price };
  if (!order.intentId) return json({ ...summary, status: "SELECT", rails: HEADLESS_RAILS });
  try {
    const payment = await getHeadlessPayment(order.intentId, order.id);
    if (!payment) return json({ error: "not found" }, 404);
    // Webhook is the primary path; this keeps local dev (no webhook delivery) in sync.
    if (order.status === "PENDING") {
      const result = await fetchIntentStatus(order.intentId, order.id);
      if (result?.status) await updateOrder(order.id, { status: result.status });
    }
    return json({ ...summary, ...payment });
  } catch (err) {
    console.error("headless status failed", err);
    return json({ error: "Gagal membaca status pembayaran" }, 502);
  }
};

/** Payer picked chain + asset: create and confirm the payment on that rail. */
export const POST: APIRoute = async ({ params, request }) => {
  const order = await getOrder(params.id!);
  if (!order) return json({ error: "not found" }, 404);
  if (order.intentId) return json({ ok: true }); // one rail per order; a new price needs a new order
  const body = await request.json().catch(() => null);
  if (!isValidRail(body?.chain, body?.asset)) return json({ error: "Chain atau asset tidak valid" }, 400);
  try {
    const intentId = await createHeadlessPayment(order, { chain: body.chain, asset: body.asset });
    await updateOrder(order.id, { intentId });
    return json({ ok: true });
  } catch (err) {
    console.error("headless payment failed", err);
    return json({ error: "Gagal membuat pembayaran, coba lagi" }, 502);
  }
};
