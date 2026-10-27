# Feedback: @mayarin/sdk 0.1.0-next.3 (status re-checked on next.4)

Found while building a game top up storefront (hosted checkout + headless deposit-match) against the testnet. Everything below was observed directly.

## Types
1. `AssetCode`, `ChainId`, `Money` are not exported from the package root. We derive them with `Parameters<...>`.
2. `settlementAsset` (`PaymentIntentDto`, `RailDto`, `PaymentRailsDto`, create body) is the full `AssetCode` union: 22 fiat, 7 stablecoin, 15 crypto. Settlement is on-chain, so fiat cannot apply. The `kind` field in the asset table could narrow it.
3. `PaymentRail.asset` is `AssetCode`, so `IDR` type-checks as an on-chain pay asset.
4. chain + asset pairs are not constrained: `{ chain: "arbitrum-sepolia", asset: "ETH" }` type-checks, API returns `VALIDATION_ERROR`.
5. `amount` is optional in the `createIntent` body; nothing distinguishes a `qr` intent from an `amount` intent.
6. Money is a plain string with no decimal-aware type (VND and JPY have 0 decimals).
7. `constructWebhook<T = unknown>`: no typed webhook event.
8. `MayarinApiError.details` is `Record<string, unknown>`; the shape of `issues` is untyped.

## Missing API surface
9. No cancel/void for a payment intent. Probing valid rails leaves intents in `Processing` until TTL.
10. Rail is fixed at `createIntent`; changing it means a new intent.
11. Rails are only readable via `paymentLinks.rails(link.id)`. Without a payment link there is no way to list rails.
12. No way to simulate a deposit on testnet, so `COMPLETED` cannot be tested end to end.
13. Hosted checkout offers "Local currency (GCash, QRIS, FPX)". No documented or typed headless path for it; `provider` is a free `string`.
14. `imageUrl` exists on cart lines only, not on `createIntent`.
15. `createIntent` always returns `checkoutUrl` and `payerToken`. The headless guide says never to send them to the client, but there is no client-safe response type.

## Behavior vs docs
16. Guide: `CONFIRMED` means show the address. Testnet: status is `PROCESSING` right after `confirmIntent` with `deposit.received = 0.000000`.
17. `confirmIntent` response had no `deposit` in our probe; `payment.get` returned it.
18. Guide step 1 uses `paymentLinks.rails(link.id)` without stating a payment link is required.

## Errors
19. `Request failed validation` is generic. The cause is in `details.issues[].path/message`, shown as `[Object]` in Node logs.
20. `imageUrl: "http://localhost:4321/..."` fails with `lines.0.imageUrl: Invalid URL`. Nothing says it must be public.
21. `FORBIDDEN` with `details: {}`; unclear whether merchant id, key scope, or something else.
22. No dry-run/validate call, so valid chain/asset pairs are found only by creating real intents.

## Packaging
23. `latest` dist-tag is `0.1.0-next.1`; `next.3` is only under `next`. Plain `npm i @mayarin/sdk` gets the oldest.
24. All releases are `next` prereleases; no changelog found for what changed between next.2 and next.3 (e.g. cart line `imageUrl`).

## Repro for 2-4 (types) and 20
```ts
import { createMayarin } from "@mayarin/sdk";
const c = createMayarin({ baseUrl: "https://api-testnet.mayarin.xyz", secretKey });
// type-checks, API rejects (VALIDATION_ERROR):
await c.payment.createIntent({ merchant, amount: { amount: "10000.00", asset: "IDR" },
  payment: { chain: "arbitrum-sepolia", asset: "ETH" }, executionPath: "deposit-match" });
// type-checks, API rejects (lines.0.imageUrl: Invalid URL):
await c.commerce.carts.checkout({ merchant, currency: "IDR", merchantReference: "x",
  lines: [{ name: "t", unitPrice: { amount: "1000.00", asset: "IDR" }, quantity: 1,
    imageUrl: "http://localhost:4321/a.png" }] });
```

## Status on 0.1.0-next.4
Fixed: 1 (`AssetCode`, `ChainId`, `OnChainAssetCode`, `MoneyDto` exported), 2-3 (`settlementAsset` is `StablecoinCode`, pay asset is `OnChainAssetCode`), 7 (typed `PaymentWebhookEvent`), 8 (`validationIssues`), 9 (`cancelIntent`), 11 (`commerce.rails()`, no payment link needed), 12 (`simulateDeposit`), 19-22 (`ValidationIssue`, `validateIntent` dry run), 23 (`latest` tag now points at the newest release).
Still open: 4 (chain/asset pair is runtime-only), 5, 6, 10 (rail still fixed at `createIntent`; we cancel + recreate), 13, 14, 15, 16 (`PROCESSING` right after confirm), 17, 21 (`FORBIDDEN` details).

## New on next.4 (found after upgrading)
25. No automatic retry: errors are flagged `retryable: true` (e.g. `NETWORK_ERROR`, "The request never reached the API") but the SDK never retries, so one dropped connection fails a whole checkout. We wrap `createIntent`/`confirmIntent` in our own `withRetry`. A `retries` option on `ClientConfig` (idempotent calls only) would help.
26. `NETWORK_ERROR` hides the cause: it is only in `error.cause` (`ECONNRESET`, timeout, DNS). Including the code in `message` would make logs useful.
27. No icon URLs for chains or assets. `RailDto` has `chain`, `asset`, `contract`, `settlementAsset` only, so integrators with their own payer UI have to ship logos themselves (the hosted checkout and dashboard already show them). Suggest `iconUrl` on rails.
28. `commerce.rails()` returns a flat list. Grouping by chain (chain, label, assets[]) is what every picker needs; a `groupByChain` helper or a grouped response would save the boilerplate.
29. No `timeoutMs` in `ClientConfig`; the only way to bound a request is passing an `AbortSignal` per call.
