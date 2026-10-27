import { randomBytes } from "node:crypto";
import { getGame } from "./catalog";
import { isMock } from "./mayarin";
import type { Order } from "./types";

/** Validate a top up request and build a PENDING order. Price always comes from the server catalog. */
export function buildOrder(body: any): { order: Order } | { error: string } {
  const game = getGame(String(body?.gameSlug ?? ""));
  const product = game?.products.find((p) => p.id === body?.productId);
  if (!game || !product) return { error: "Game atau produk tidak valid" };

  const userId = String(body.userId ?? "").trim();
  const zoneId = String(body.zoneId ?? "").trim();
  const idRule = game.fields[0].format === "username" ? /^[A-Za-z0-9_]{3,20}$/ : /^\d{4,20}$/;
  if (!idRule.test(userId)) return { error: `${game.fields[0].label} tidak valid` };
  const zoneField = game.fields.find((f) => f.key === "zoneId");
  if (zoneField && (zoneField.options ? !zoneField.options.includes(zoneId) : !/^\d{1,8}$/.test(zoneId)))
    return { error: `${zoneField.label} tidak valid` };

  const now = new Date().toISOString();
  return {
    order: {
      id: "GF" + randomBytes(5).toString("hex").toUpperCase(),
      gameSlug: game.slug,
      gameName: game.name,
      productId: product.id,
      productName: product.name,
      gameImage: game.checkoutImage,
      price: product.price,
      account: { userId, ...(zoneField ? { zoneId } : {}) },
      status: "PENDING",
      mock: isMock,
      createdAt: now,
      updatedAt: now,
    },
  };
}
