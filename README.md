# GamingFun – Mayarin SDK example

Demo storefront for game top ups (Mobile Legends, Genshin Impact, Free Fire, Roblox, Ragnarok M, Call of Duty Mobile) paid with crypto via [Mayarin](https://docs.mayarin.xyz/).

Stack: Astro 5 (SSR), React, TypeScript, Tailwind v4, `@mayarin/sdk`. No database: catalog is `src/data/games.json`, orders are written to `data/orders.json`.

## Run

```bash
npm install
cp .env.example .env   # fill MAYARIN_API_KEY, MAYARIN_MERCHANT_ID, ...
npm run dev            # http://localhost:4321
```

Without `MAYARIN_API_KEY` the app runs in demo mode with a simulated payment page.

## How payment works

1. `POST /api/checkout` validates input, prices the order from the server catalog, creates an order and a Mayarin hosted checkout (`commerce.carts.checkout`).
2. The browser opens the checkout in a modal (`openCheckout` from `@mayarin/sdk/embed`).
3. Status is confirmed server-side: `POST /api/webhooks/mayarin` (signature verified, intent re-read) and, as a fallback, `GET /api/orders/[id]` re-reads the intent from Mayarin.

## Notes

- Webhooks need `MAYARIN_WEBHOOK_SECRET` and a public URL (tunnel in local dev).
- File-based order store needs a writable filesystem; not suitable for serverless hosts.
- Edit `scripts/gen-data.mjs` and run `node scripts/gen-data.mjs` to regenerate the catalog.
