import { useEffect, useState } from "react";
import { openCheckout } from "@mayarin/sdk/embed";
import { rupiah } from "../lib/format";

interface Info {
  id: string;
  gameName: string;
  productName: string;
  price: number;
  status: string;
  createdAt: string;
  checkoutUrl?: string;
  mock?: boolean;
}

const label: Record<string, [string, string]> = {
  PENDING: ["Menunggu Pembayaran", "text-gold"],
  PAID: ["Pembayaran Diterima, Diproses", "text-brand"],
  COMPLETED: ["Selesai", "text-brand"],
  FAILED: ["Gagal", "text-red-400"],
  EXPIRED: ["Kedaluwarsa", "text-red-400"],
};

export default function OrderStatus({ initial }: { initial: Info }) {
  const [info, setInfo] = useState(initial);

  const refresh = async () => {
    const res = await fetch(`/api/orders/${info.id}`);
    if (res.ok) setInfo(await res.json());
  };

  function pay() {
    if (!info.checkoutUrl) return;
    if (info.mock) {
      window.location.href = info.checkoutUrl;
      return;
    }
    // Modal over this page:
    openCheckout(new URL(info.checkoutUrl, window.location.href).href, {
      onSuccess: refresh,
      onFailed: refresh,
      onClose: refresh,
    });

    // // Checkout UI in a new tab; status polling below picks up the result.
    // window.open(info.checkoutUrl, "_blank");
  }

  useEffect(() => {
    if (info.status !== "PENDING") return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [info.id, info.status]);

  const [text, color] = label[info.status] ?? [info.status, ""];
  return (
    <div className="rounded-2xl bg-card border border-line p-6 max-w-lg mx-auto space-y-3">
      <div className="text-sm text-white/60">
        Order <span className="font-mono">{info.id}</span>
      </div>
      <div className={`text-xl font-extrabold ${color}`}>{text}</div>
      <div className="text-sm">
        {info.gameName} · {info.productName}
      </div>
      <div className="text-brand font-bold">{rupiah(info.price)}</div>
      <div className="text-xs text-white/40">
        {new Date(info.createdAt).toLocaleString("id-ID")}
      </div>
      {info.status === "PENDING" && info.checkoutUrl && (
        <button
          type="button"
          onClick={pay}
          className="w-full h-12 rounded-full bg-brand text-bg font-bold hover:bg-brand-dim"
        >
          Bayar Sekarang
        </button>
      )}
      {info.status === "PENDING" && !info.checkoutUrl && (
        <a
          href={`/headless/pay/${info.id}`}
          className="block text-center leading-12 w-full h-12 rounded-full bg-brand text-bg font-bold hover:bg-brand-dim"
        >
          Lanjut Bayar
        </a>
      )}
    </div>
  );
}
