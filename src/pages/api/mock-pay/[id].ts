import type { APIRoute } from "astro";
import { getOrder, updateOrder } from "../../../lib/orders";
import { isMock } from "../../../lib/mayarin";

// Simulated payment for demo mode (no Mayarin key). Disabled when a real key is set.
export const POST: APIRoute = async ({ params, redirect }) => {
  if (!isMock) return new Response("disabled", { status: 404 });
  const order = await getOrder(params.id!);
  if (!order) return new Response("not found", { status: 404 });
  if (order.status === "PENDING") await updateOrder(order.id, { status: "PAID" });
  return redirect(`/order/${order.id}`, 303);
};
