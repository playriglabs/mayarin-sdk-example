import type { APIRoute } from "astro";
import { randomBytes } from "node:crypto";
import { getGame } from "../../lib/catalog";
import { createOrder, updateOrder } from "../../lib/orders";
import { createCheckout, isMock } from "../../lib/mayarin";
import type { Order } from "../../lib/types";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => null);
  const game = getGame(String(body?.gameSlug ?? ""));
  const product = game?.products.find((p) => p.id === body?.productId);
  if (!game || !product) return json({ error: "Game atau produk tidak valid" }, 400);

  const userId = String(body.userId ?? "").trim();
  const zoneId = String(body.zoneId ?? "").trim();
  if (!/^\d{4,20}$/.test(userId)) return json({ error: `${game.fields[0].label} tidak valid` }, 400);
  const zoneField = game.fields.find((f) => f.key === "zoneId");
  if (zoneField && (zoneField.options ? !zoneField.options.includes(zoneId) : !/^\d{1,8}$/.test(zoneId)))
    return json({ error: `${zoneField.label} tidak valid` }, 400);

  const now = new Date().toISOString();
  const order: Order = {
    id: "GF" + randomBytes(5).toString("hex").toUpperCase(),
    gameSlug: game.slug,
    gameName: game.name,
    productId: product.id,
    productName: product.name,
    productImage: product.image,
    price: product.price, // price always from server catalog, never from client
    account: { userId, ...(zoneField ? { zoneId } : {}) },
    status: "PENDING",
    mock: isMock,
    createdAt: now,
    updatedAt: now,
  };
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
