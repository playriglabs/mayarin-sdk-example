import type { APIRoute } from "astro";
import { createOrder, updateOrder } from "../../lib/orders";
import { createCheckout } from "../../lib/mayarin";
import { buildOrder } from "../../lib/new-order";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const built = buildOrder(body);
  if ("error" in built) return json({ error: built.error }, 400);
  const { order } = built;
  await createOrder(order);

  try {
    const { url } = await createCheckout(order);
    await updateOrder(order.id, { checkoutUrl: url });
    return json({ orderId: order.id, url, mock: order.mock });
  } catch (err) {
    await updateOrder(order.id, { status: "FAILED" });
    console.error("checkout failed", err);
    return json({ error: "Gagal membuat pembayaran, coba lagi" }, 502);
  }
};
