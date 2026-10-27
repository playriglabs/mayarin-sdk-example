import { chainLabel, type ChainId, type OnChainAssetCode } from "@mayarin/sdk";
import { getClient, isTestnet, merchant, toMoney, withRetry } from "./client";
import { orderMetadata } from "./hosted";
import type { Order } from "../types";

export type Rail = { chain: ChainId; asset: OnChainAssetCode };

/**
 * Headless checkout: no hosted page. Create + confirm a deposit-match intent on the backend;
 * confirming locks the price and allocates a unique deposit address.
 * Idempotency key is per (order, rail, attempt) so a double tap reuses the intent, while
 * a new attempt after `cancelHeadlessPayment` gets a fresh one.
 */
export async function createHeadlessPayment(
  order: Order,
  rail: Rail,
  attempt: number,
) {
  const { payment } = getClient();
  const key = `${order.id}:${rail.chain}:${rail.asset}:${attempt}`;
  const intent = await withRetry(() =>
    payment.createIntent(
      {
        merchant,
        amount: toMoney(order.price),
        payment: rail,
        executionPath: "deposit-match",
        merchantReference: order.id,
        metadata: orderMetadata(order),
      },
      { idempotencyKey: key },
    ),
  );
  await withRetry(() =>
    payment.confirmIntent(intent.id, { idempotencyKey: `${key}:confirm` }),
  );
  return intent.id;
}

/** Void an unpaid intent (409 if a payment is already under way). */
export const cancelHeadlessPayment = (intentId: string) =>
  getClient().payment.cancelIntent(intentId);

/** Testnet only: have Mayarin send the amount to the deposit address, then follow with polling. */
export async function simulateHeadlessDeposit(intentId: string) {
  if (!isTestnet) throw new Error("simulateDeposit hanya untuk testnet");
  await getClient().payment.simulateDeposit(intentId);
}

/** Client-safe view of a headless payment. Never exposes checkoutUrl / payerToken. */
export async function getHeadlessPayment(
  intentId: string,
  expectedOrderId: string,
) {
  const { paymentIntent, deposit } = await getClient().payment.get(intentId);
  if (
    paymentIntent.merchant.id !== merchant.id ||
    paymentIntent.merchantReference !== expectedOrderId
  )
    return undefined;
  return {
    status: paymentIntent.status,
    expiresAt: paymentIntent.expiresAt,
    failureReason: paymentIntent.failureReason,
    canSimulate: isTestnet,
    deposit: deposit && {
      address: deposit.address,
      chain: deposit.chain,
      chainLabel: chainLabel(deposit.chain),
      asset: deposit.asset,
      amount: deposit.amount.formatted, // machine-readable, not the localized `display`
      received: deposit.received.formatted,
      uri: deposit.uri,
    },
  };
}
