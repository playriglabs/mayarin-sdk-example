import { useState } from "react";
import { openCheckout } from "@mayarin/sdk/embed";
import type { Game } from "../lib/types";
import { rupiah } from "../lib/format";

const inputCls =
  "w-full h-11 rounded-xl bg-surface border border-line px-3 text-sm outline-none focus:border-brand";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card border border-line overflow-hidden">
      <div className="flex items-center bg-black/30">
        <span className="w-12 h-11 grid place-items-center bg-brand text-bg font-bold">
          {n}
        </span>
        <h2 className="px-4 font-semibold">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

type CheckoutMode = "headless" | "modal" | "tab";

const MODES: { id: CheckoutMode; title: string; desc: string }[] = [
  {
    id: "headless",
    title: "Headless",
    desc: "UI bayar sendiri: pilih jaringan, QR, alamat deposit",
  },
  {
    id: "modal",
    title: "Modal",
    desc: "Checkout Mayarin dalam iframe di atas halaman ini",
  },
  { id: "tab", title: "Tab Mayarin Pay", desc: "Checkout Mayarin di tab baru" },
];

export default function TopupForm({ game }: { game: Game }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [productId, setProductId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [mode, setMode] = useState<CheckoutMode>("modal");

  const product = game.products.find((p) => p.id === productId);
  const filled = game.fields.every((f) => values[f.key]?.trim());

  async function submit() {
    if (!product || !filled)
      return setError("Lengkapi data akun dan pilih nominal");
    setLoading(true);
    setError(undefined);
    // Tab mode: open the tab synchronously in the click handler so popup blockers allow it.
    const tab: Window | null =
      mode === "tab" ? window.open("about:blank", "_blank") : null;
    try {
      const body = JSON.stringify({
        gameSlug: game.slug,
        productId: product.id,
        ...values,
      });
      const post = async (url: string) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Gagal");
        return data;
      };

      if (mode === "headless") {
        // Backend creates + confirms the payment later; our own UI picks the rail and shows the deposit.
        const data = await post("/api/headless/checkout");
        window.location.href = `/headless/pay/${data.orderId}`;
        return;
      }

      // Hosted checkout (modal or tab). Webhook confirms payment server-side; the UI callbacks are UI-only.
      const data = await post("/api/checkout");
      const orderUrl = `/order/${data.orderId}`;
      if (data.mock) {
        tab?.close();
        window.location.href = data.url; // simulated payment page, no embed protocol
        return;
      }
      if (mode === "modal") {
        openCheckout(new URL(data.url, window.location.href).href, {
          onSuccess: () => (window.location.href = orderUrl),
          onFailed: () => (window.location.href = orderUrl),
          onClose: () => {
            setLoading(false);
            window.location.href = orderUrl;
          },
        });
        return;
      }
      // Tab: this page goes to the order status page, which polls until the webhook confirms.
      if (tab) tab.location.href = data.url;
      else window.open(data.url, "_blank"); // blocked earlier: best effort
      window.location.href = orderUrl;
    } catch (e) {
      tab?.close();
      setError(e instanceof Error ? e.message : "Gagal");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
      <div className="space-y-6">
        <Step n={1} title="Masukkan Data Akun">
          <div className="grid gap-4 sm:grid-cols-2">
            {game.fields.map((f) => (
              <label key={f.key} className="text-sm">
                <span className="block mb-1.5">{f.label}</span>
                {f.type === "select" ? (
                  <div className="relative">
                    <select
                      className={`${inputCls} appearance-none pr-10 scheme-dark`}
                      value={values[f.key] ?? ""}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    >
                      <option value="" disabled>
                        {f.placeholder}
                      </option>
                      {f.options?.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <svg
                      aria-hidden
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-brand"
                    >
                      <path d="m5 8 5 5 5-5" />
                    </svg>
                  </div>
                ) : (
                  <input
                    className={inputCls}
                    inputMode={f.format === "username" ? "text" : "numeric"}
                    placeholder={f.placeholder}
                    value={values[f.key] ?? ""}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        [f.key]: e.target.value.replace(
                          f.format === "username" ? /[^A-Za-z0-9_]/g : /\D/g,
                          "",
                        ),
                      })
                    }
                  />
                )}
              </label>
            ))}
          </div>
        </Step>

        <Step n={2} title="Pilih Nominal">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
            {game.products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setProductId(p.id)}
                className={`text-left rounded-xl border p-3 transition ${
                  p.id === productId
                    ? "border-brand bg-brand/15"
                    : "border-line bg-surface hover:border-brand/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={p.image}
                    alt=""
                    width="36"
                    height="36"
                    className="size-9 shrink-0"
                  />
                  <div>
                    <div className="text-sm font-semibold uppercase leading-snug">
                      {p.name}
                    </div>
                    <div className="mt-1 text-brand font-bold">
                      {rupiah(p.price)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Step>

        <Step n={3} title="Metode Checkout">
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`text-left rounded-xl border p-3 transition ${
                  m.id === mode
                    ? "border-brand bg-brand/15"
                    : "border-line bg-surface hover:border-brand/60"
                }`}
              >
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="mt-1 text-xs text-white/60">{m.desc}</div>
              </button>
            ))}
          </div>
        </Step>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-2xl border border-dashed border-line bg-card p-5 min-h-28">
          {product ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 font-semibold">
                <img src={product.image} alt="" className="size-7" />
                {product.name}
              </div>
              <div className="flex justify-between text-white/70">
                <span>Total</span>
                <span className="text-brand font-bold">
                  {rupiah(product.price)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-white/40 text-sm pt-6">
              Belum ada item produk yang dipilih.
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={loading || !product || !filled}
          className="w-full h-12 rounded-full bg-brand text-bg font-bold disabled:opacity-40 hover:bg-brand-dim"
        >
          {loading ? "Memproses..." : "Pesan Sekarang!"}
        </button>
        <p className="text-xs text-white/40 text-center">
          Pembayaran crypto diproses oleh Mayarin.
        </p>
      </aside>
    </div>
  );
}
