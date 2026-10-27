import { constructWebhook as construct, type MayarinClient } from "@mayarin/sdk";
import { getClient, merchant } from "./client";
import type { OrderStatus } from "../types";

type IntentStatus = Awaited<ReturnType<MayarinClient["payment"]["getIntent"]>>["status"];

const FINAL: Partial<Record<IntentStatus, OrderStatus>> = {
  COMPLETED: "PAID",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
};

/** Source of truth: re-read intent from Mayarin and map to order status. */
export async function fetchIntentStatus(intentId: string, expectedOrderId?: string) {
  const { paymentIntent } = await getClient().payment.get(intentId);
  if (paymentIntent.merchant.id !== merchant.id) return undefined;
  if (expectedOrderId && paymentIntent.merchantReference !== expectedOrderId) return undefined;
  return {
    orderId: paymentIntent.merchantReference ?? undefined,
    status: FINAL[paymentIntent.status],
  };
}

/** Verify + parse a payment webhook (typed `PaymentWebhookEvent`). */
export const constructWebhook = construct;
