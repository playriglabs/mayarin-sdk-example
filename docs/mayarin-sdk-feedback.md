# Feedback: @mayarin/sdk 0.1.0-next.4

Found while building a game top up storefront (hosted checkout + headless deposit-match) against the testnet. First written against `0.1.0-next.3`, re-checked on `0.1.0-next.4`. Items are marked:

- **verified**: reproduced on next.4 (runtime or `.d.ts`)
- **not re-tested**: seen on next.3, not re-run on next.4

## Fixed in next.4 (thanks)
| Was | Now |
|---|---|
| `AssetCode`, `ChainId`, `Money` not exported | `AssetCode`, `ChainId`, `CHAIN_IDS`, `OnChainAssetCode`, `StablecoinCode`, `MoneyDto` exported |
| `settlementAsset` was the full `AssetCode` union; `IDR` type-checked as a pay asset | `settlementAsset?: StablecoinCode`, `payment.asset: OnChainAssetCode` |
| `constructWebhook<T = unknown>` | typed `PaymentWebhookEvent`, `WebhookPaymentState` |
| `MayarinApiError.details` untyped; `[Object]` in logs | `validationIssues(error)` returns `{ path, message }[]` |
| No cancel for an intent | `payment.cancelIntent` |
| Rails needed a payment link | `commerce.rails()` (merchant level) |
| No way to reach `COMPLETED` on testnet | `payment.simulateDeposit` |
| No dry run; valid rails found by creating intents | `payment.validateIntent` |
| `createIntent` returned `checkoutUrl`/`payerToken` with no safe type | `toClientSafe()` / `ClientSafePaymentIntent` |
| `latest` dist-tag pointed at `next.1` | `latest` = `next` = `0.1.0-next.4` |

## Still open

### Types
1. chain + asset pairs are not constrained by type. `{ chain: "arbitrum-sepolia", asset: "ETH" }` type-checks; the API refuses it. Only `commerce.rails()` at runtime knows the pairs. **verified** (`CreatePaymentIntentBody` narrows asset only)
2. `amount` is optional in the `createIntent` body, and nothing distinguishes a `qr` intent from an `amount` intent. **verified**
3. Money is a plain string with no decimal-aware type (VND and JPY have 0 decimals, IDR has 2). **verified**
4. `RailDto.asset` and `RailDto.settlementAsset` are still `AssetCode`, while `createIntent` now takes `OnChainAssetCode` / `StablecoinCode`. Reading a rail and passing it to `createIntent` needs a cast. **verified**

### API surface
5. Rail is fixed at `createIntent`; switching chain/asset means `cancelIntent` + a new intent. **verified**
6. `provider` is a free `string`. Hosted checkout offers "Local currency (GCash, QRIS, FPX)" but there is no documented or typed headless path for it. **verified**
7. `imageUrl` exists on cart lines only, not on `createIntent`. **verified**
8. No icon URLs for chains or assets. `RailDto` has `chain`, `asset`, `contract`, `settlementAsset` only, so integrators with their own payer UI ship logos themselves, while the hosted checkout and dashboard already show them. Suggest `iconUrl`. **verified**
9. `commerce.rails()` is a flat list; every picker groups it by chain. A grouped response or helper would save the boilerplate. **verified**

### Behavior vs docs
10. Guide: `CONFIRMED` means show the address. Testnet: status is `PROCESSING` right after `confirmIntent` with `deposit.received = 0.000000`. **verified** (we key the UI off `deposit` instead of status)
11. `confirmIntent` response had no `deposit` while `payment.get` did. **not re-tested**

### Resilience and errors
12. No automatic retry. Errors are flagged `retryable: true` (e.g. `NETWORK_ERROR`, "The request never reached the API") but the SDK never retries, so one dropped connection fails a whole checkout. We wrap calls in our own `withRetry`. A `retries` option on `ClientConfig` for idempotent calls would help. **verified** (hit it on a real checkout)
13. `NETWORK_ERROR` hides the cause: it is only in `error.cause` (`ECONNRESET`, timeout, DNS). Putting the code in `message` would make logs useful. **verified**
14. No `timeoutMs` in `ClientConfig`; a request can only be bounded with a per-call `AbortSignal`. **verified** (`timeoutMs` exists only on `waitFor`)
15. `FORBIDDEN` came back with `details: {}`; unclear whether merchant id, key scope or something else. **not re-tested**
16. `imageUrl: "http://localhost:..."` fails with `lines.0.imageUrl: Invalid URL`, with no hint that it must be public. `validationIssues` now surfaces the path, but not the reason. **not re-tested**

### Packaging
17. Still a `next` prerelease and no changelog found for next.2 to next.4. **verified**

## Repro for 1 and 4
```ts
import { createMayarin } from "@mayarin/sdk";
const c = createMayarin({ baseUrl: "https://api-testnet.mayarin.xyz", secretKey });
// type-checks, API refuses (VALIDATION_ERROR): ETH is not offered on arbitrum-sepolia
await c.payment.validateIntent({ merchant, amount: { amount: "10000.00", asset: "IDR" },
  payment: { chain: "arbitrum-sepolia", asset: "ETH" }, executionPath: "deposit-match" });
// rails come back as AssetCode, createIntent wants OnChainAssetCode
const { rails } = await c.commerce.rails();
await c.payment.validateIntent({ merchant, amount, payment: { chain: rails[0].chain, asset: rails[0].asset } }); // type error
```
