import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { rupiah } from "../lib/format";
import { chainLabel } from "../lib/rails";
import type { Asset, Chain } from "../lib/types";

interface Payment {
  orderId: string;
  gameName: string;
  productName: string;
  price: number;
  status: "SELECT" | "CREATED" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";
  expiresAt: string;
  failureReason: string | null;
  rails?: { chain: Chain; label: string; assets: Asset[] }[];
  deposit: { address: string; chain: string; asset: string; amount: string; received: string; uri: string | null } | null;
}

const useCountdown = (iso?: string) => {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
};

export default function HeadlessPay({ orderId, retryHref }: { orderId: string; retryHref: string }) {
  const [p, setP] = useState<Payment>();
  const [error, setError] = useState<string>();
  const [qr, setQr] = useState<string>();
  const [copied, setCopied] = useState<string>();
  const [chain, setChain] = useState<Chain>();
  const [asset, setAsset] = useState<Asset>();
  const [paying, setPaying] = useState(false);
  const countdown = useCountdown(p?.expiresAt);

  // Poll our backend; it reads the payment from Mayarin. Final state is confirmed server-side via webhook.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/headless/${orderId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (stop) return;
        setP(data);
        setError(undefined);
        if (["SELECT", "COMPLETED", "FAILED", "EXPIRED"].includes(data.status)) return;
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Gagal");
      }
      if (!stop) setTimeout(poll, 3000);
    };
    poll();
    return () => { stop = true; };
  }, [orderId, tick]);

  const uri = p?.deposit?.uri ?? p?.deposit?.address;
  useEffect(() => {
    if (uri) QRCode.toDataURL(uri, { margin: 1, width: 240 }).then(setQr);
  }, [uri]);

  const copy = (key: string, text: string) =>
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(undefined), 1500);
    });

  async function start() {
    if (!chain || !asset) return;
    setPaying(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/headless/${orderId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chain, asset }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Gagal");
      setP(undefined);
      setTick((t) => t + 1); // restart polling, now with a deposit
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    }
    setPaying(false);
  }

  if (!p) return <p className="text-center text-white/60">{error ?? "Memuat pembayaran..."}</p>;
  const d = p.deposit;
  // Testnet reports PROCESSING right after confirm, before any funds arrive, so key off the deposit instead.
  const waiting = !["SELECT", "COMPLETED", "FAILED", "EXPIRED"].includes(p.status);

  return (
    <div className="rounded-2xl bg-card border border-line p-6 max-w-lg mx-auto space-y-4">
      <div className="text-sm text-white/60">Order <span className="font-mono">{p.orderId}</span></div>
      <div className="text-sm">{p.gameName} · {p.productName} · <span className="text-brand font-bold">{rupiah(p.price)}</span></div>

      {p.status === "SELECT" && (
        <>
          <Pick title="1. Pilih jaringan">
            {p.rails?.map((r) => (
              <Chip key={r.chain} active={chain === r.chain}
                onClick={() => { setChain(r.chain); setAsset(r.assets.length === 1 ? r.assets[0] : undefined); }}>
                {r.label}
              </Chip>
            ))}
          </Pick>
          {chain && (
            <Pick title="2. Pilih aset">
              {p.rails?.find((r) => r.chain === chain)?.assets.map((a) => (
                <Chip key={a} active={asset === a} onClick={() => setAsset(a)}>{a}</Chip>
              ))}
            </Pick>
          )}
          <button type="button" onClick={start} disabled={!chain || !asset || paying}
            className="w-full h-12 rounded-full bg-brand text-bg font-bold disabled:opacity-40 hover:bg-brand-dim">
            {paying ? "Memproses..." : asset && chain ? `Lanjut dengan ${asset}` : "Pilih jaringan dan aset"}
          </button>
        </>
      )}
      {waiting && d && (
        <>
          <div className="flex justify-center"><div className="rounded-xl bg-white p-2">{qr && <img src={qr} alt="QR deposit" width="240" height="240" />}</div></div>
          <div className="text-center text-sm text-white/70">Kirim tepat <b>{d.asset}</b> di jaringan <b>{chainLabel(d.chain)}</b>. Transfer di jaringan lain tidak akan masuk.</div>
          <Row label="Jumlah" value={`${d.amount} ${d.asset}`} onCopy={() => copy("a", d.amount)} copied={copied === "a"} />
          <Row label="Alamat" value={d.address} mono onCopy={() => copy("d", d.address)} copied={copied === "d"} />
          <div className="text-center text-sm text-white/60">Berlaku <span className="font-mono text-brand">{countdown}</span></div>
          {Number(d.received) > 0 && <div className="text-xs text-white/50 text-center">Diterima {d.received} {d.asset}, menunggu konfirmasi. Kekurangan bisa ditambah sebelum kedaluwarsa.</div>}
        </>
      )}
      {waiting && !d && <Banner tone="text-brand">Dana diterima, menunggu konfirmasi jaringan...</Banner>}
      {p.status === "COMPLETED" && <Banner tone="text-green-400">Pembayaran berhasil. Top up sedang diproses.</Banner>}
      {p.status === "FAILED" && <Banner tone="text-red-400">Pembayaran gagal{p.failureReason ? `: ${p.failureReason}` : ""}.</Banner>}
      {p.status === "EXPIRED" && <Banner tone="text-red-400">Pembayaran kedaluwarsa. Harga baru perlu persetujuanmu.</Banner>}
      {(p.status === "FAILED" || p.status === "EXPIRED") && (
        <a href={retryHref} className="block text-center h-12 leading-[3rem] rounded-full bg-brand text-bg font-bold hover:bg-brand-dim">Buat pembayaran baru</a>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

const Banner = ({ tone, children }: { tone: string; children: React.ReactNode }) => (
  <div className={`text-center font-bold ${tone}`}>{children}</div>
);

function Row({ label, value, mono, onCopy, copied }: { label: string; value: string; mono?: boolean; onCopy: () => void; copied: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-surface border border-line px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-white/50">{label}</div>
        <div className={`truncate text-sm ${mono ? "font-mono" : "font-semibold"}`}>{value}</div>
      </div>
      <button type="button" onClick={onCopy} className="text-xs text-brand font-semibold">{copied ? "Tersalin" : "Salin"}</button>
    </div>
  );
}

const Pick = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div>
    <div className="text-sm mb-2 text-white/70">{title}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick}
    className={`px-3 h-10 rounded-xl border text-sm font-semibold transition ${
      active ? "border-brand bg-brand/15 text-brand" : "border-line bg-surface hover:border-brand/60"
    }`}>
    {children}
  </button>
);
