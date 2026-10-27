import type { APIRoute } from "astro";
import { isMayarinApiError } from "@mayarin/sdk";
import { getOrder, updateOrder } from "../../../lib/orders";
import {
  cancelHeadlessPayment,
  createHeadlessPayment,
  describeError,
  fetchIntentStatus,
  getHeadlessPayment,
  getRails,
  isOfferedRail,
  simulateHeadlessDeposit,
} from "../../../lib/mayarin";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Payment state for the payer's screen: rail picker until a rail is chosen, then the deposit. */
export const GET: APIRoute = async ({ params }) => {
  const order = await getOrder(params.id!);
  if (!order) return json({ error: "not found" }, 404);
  const summary = { orderId: order.id, productName: order.productName, gameName: order.gameName, price: order.price };
  try {
    if (!order.intentId) return json({ ...summary, status: "SELECT", rails: await getRails() });
    const payment = await getHeadlessPayment(order.intentId, order.id);
    if (!payment) return json({ error: "not found" }, 404);
    // Webhook is the primary path; this keeps local dev (no webhook delivery) in sync.
    if (order.status === "PENDING") {
      const result = await fetchIntentStatus(order.intentId, order.id);
      if (result?.status) await updateOrder(order.id, { status: result.status });
    }
    return json({ ...summary, ...payment });
  } catch (err) {
    console.error("headless status failed", describeError(err));
    return json({ error: "Gagal membaca status pembayaran" }, 502);
  }
};

/** Payer picked chain + asset: create and confirm the payment on that rail. */
export const POST: APIRoute = async ({ params, request }) => {
  const order = await getOrder(params.id!);
  if (!order) return json({ error: "not found" }, 404);
  if (order.intentId) return json({ ok: true }); // already created (double tap)
  const body = await request.json().catch(() => null);
  try {
    if (!(await isOfferedRail(body?.chain, body?.asset))) return json({ error: "Chain atau asset tidak tersedia" }, 400);
    const attempt = (order.attempts ?? 0) + 1;
    const intentId = await createHeadlessPayment(order, { chain: body.chain, asset: body.asset }, attempt);
    await updateOrder(order.id, { intentId, attempts: attempt });
    return json({ ok: true });
  } catch (err) {
    console.error("headless payment failed", describeError(err));
    return json({ error: "Gagal membuat pembayaran, coba lagi" }, 502);
  }
};

/** Payer wants another chain/asset: void the unpaid intent and go back to the picker. */
export const DELETE: APIRoute = async ({ params }) => {
  const order = await getOrder(params.id!);
  if (!order?.intentId) return json({ error: "not found" }, 404);
  try {
    await cancelHeadlessPayment(order.intentId);
    await updateOrder(order.id, { intentId: undefined });
    return json({ ok: true });
  } catch (err) {
    if (isMayarinApiError(err) && err.status === 409) return json({ error: "Pembayaran sudah berjalan, tidak bisa diganti" }, 409);
    console.error("headless cancel failed", describeError(err));
    return json({ error: "Gagal mengganti jaringan" }, 502);
  }
};

/** Testnet only: ask Mayarin to send the deposit, so the flow can reach COMPLETED without a wallet. */
export const PUT: APIRoute = async ({ params }) => {
  const order = await getOrder(params.id!);
  if (!order?.intentId) return json({ error: "not found" }, 404);
  try {
    await simulateHeadlessDeposit(order.intentId);
    return json({ ok: true });
  } catch (err) {
    console.error("simulate deposit failed", describeError(err));
    return json({ error: "Simulasi deposit gagal" }, 502);
  }
};
