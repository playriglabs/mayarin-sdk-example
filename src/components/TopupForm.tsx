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

export default function TopupForm({ game }: { game: Game }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [productId, setProductId] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const product = game.products.find((p) => p.id === productId);
  const filled = game.fields.every((f) => values[f.key]?.trim());

  async function submit() {
    if (!product || !filled)
      return setError("Lengkapi data akun dan pilih nominal");
    setLoading(true);
    setError(undefined);
    try {
      // Headless checkout: backend creates + confirms the payment, our own UI shows the deposit.
      // const res = await fetch("/api/headless/checkout", {
      //   method: "POST",
      //   headers: { "content-type": "application/json" },
      //   body: JSON.stringify({ gameSlug: game.slug, productId: product.id, ...values }),
      // });
      // const data = await res.json();
      // if (!res.ok) throw new Error(data.error ?? "Gagal");
      // window.location.href = `/headless/pay/${data.orderId}`;

      // --- Hosted checkout (new tab / modal), disabled in favor of headless ---
      // // Open the tab synchronously in the click handler so popup blockers allow it.
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          gameSlug: game.slug,
          productId: product.id,
          ...values,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal");
      const orderUrl = `/order/${data.orderId}`;

      // Modal over this page. onSuccess is UI-only; webhook confirms payment server-side.
      openCheckout(new URL(data.url, window.location.href).href, {
        onSuccess: () => (window.location.href = orderUrl),
        onFailed: () => (window.location.href = orderUrl),
        onClose: () => {
          setLoading(false);
          window.location.href = orderUrl;
        },
      });
      // // Checkout UI in a new tab; this page goes to the order status page (polls until webhook confirms).
      // if (tab) tab.location.href = data.url;
      // else window.open(data.url, "_blank"); // blocked earlier: best effort
      // window.location.href = orderUrl;
    } catch (e) {
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
