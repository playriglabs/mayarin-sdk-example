import type { APIRoute } from "astro";
import { createOrder } from "../../../lib/orders";
import { isMock } from "../../../lib/mayarin";
import { buildOrder } from "../../../lib/new-order";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  if (isMock) return json({ error: "Headless checkout butuh MAYARIN_SECRET_KEY" }, 503);
  const body = await request.json().catch(() => null);
  const built = buildOrder(body);
  if ("error" in built) return json({ error: built.error }, 400);
  const { order } = built;
  await createOrder(order); // payment is created later, once the payer picks chain + asset
  return json({ orderId: order.id });
};
