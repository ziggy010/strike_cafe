"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Plus, Printer, Trash2 } from "lucide-react";
import { getStore } from "@/lib/store";
import { BASE_PATH } from "@/lib/assets";
import { useDB } from "@/lib/useStore";
import { isOpen } from "@/lib/types";

export default function TablesPage() {
  const db = useDB();
  const [newLabel, setNewLabel] = useState("");
  const [qrs, setQrs] = useState<Record<string, string>>({});

  // Render QR data URLs whenever tables change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const t of db.tables) {
        next[t.id] = await QRCode.toDataURL(`${window.location.origin}${BASE_PATH}/t/${t.id}/`, {
          width: 480,
          margin: 2,
          color: { dark: "#1f3328", light: "#ffffff" },
        });
      }
      if (!cancelled) setQrs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [db.tables]);

  const activeOrders = (tableId: string) => db.orders.filter((o) => o.tableId === tableId && isOpen(o)).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl text-pitch">Tables & QR codes</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-ctl border border-pitch/30 px-3.5 py-2.5 text-sm font-bold text-pitch"
        >
          <Printer size={16} /> Print all
        </button>
      </div>

      <form
        className="mt-4 flex gap-2 print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (newLabel.trim()) {
            getStore().addTable(newLabel.trim());
            setNewLabel("");
          }
        }}
      >
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New table name, e.g. T9 or Terrace 2"
          className="min-w-0 flex-1 rounded-ctl border border-line bg-surface px-4 py-3 outline-none placeholder:text-ink-faint focus:border-pitch-bright"
        />
        <button
          type="submit"
          disabled={!newLabel.trim()}
          className="flex items-center gap-1.5 rounded-ctl bg-pitch px-4 py-3 text-sm font-bold text-cream disabled:opacity-40"
        >
          <Plus size={16} /> Add
        </button>
      </form>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-2 print:gap-8">
        {db.tables.map((t) => {
          const open = activeOrders(t.id);
          return (
            <div key={t.id} className="rounded-card border border-line bg-surface p-4 text-center shadow-lift print:break-inside-avoid print:border-2 print:shadow-none">
              {/* Print header — what a customer sees on the table tent */}
              <p className="hidden font-display text-lg text-pitch print:block">{db.settings.cafeName}</p>
              <p className="hidden text-xs text-ink-soft print:block">Scan to order from your table</p>

              {qrs[t.id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrs[t.id]} alt={`QR code for table ${t.label}`} className="mx-auto w-full max-w-44" />
              ) : (
                <div className="mx-auto aspect-square w-full max-w-44 animate-pulse rounded-ctl bg-cream" />
              )}
              <p className="mt-1 font-display text-xl">{t.label}</p>

              <div className="mt-1 flex items-center justify-center gap-2 text-xs font-bold print:hidden">
                {open > 0 ? (
                  <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-saffron-deep">
                    {open} open order{open > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="text-ink-faint">Free</span>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-center gap-1 print:hidden">
                <a
                  href={qrs[t.id]}
                  download={`strike-yard-${t.label.replace(/\s+/g, "-").toLowerCase()}.png`}
                  aria-label={`Download QR for ${t.label}`}
                  className="flex h-10 w-10 items-center justify-center rounded-ctl text-ink-soft hover:bg-cream hover:text-ink"
                >
                  <Download size={17} />
                </a>
                <button
                  type="button"
                  aria-label={`Remove ${t.label}`}
                  onClick={() => {
                    if (open > 0) {
                      window.alert(`${t.label} still has open orders — close them first.`);
                      return;
                    }
                    if (window.confirm(`Remove table ${t.label}? Its QR code will stop working.`)) {
                      getStore().removeTable(t.id);
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-ctl text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-ink-faint print:hidden">
        QR codes point to this site/t/&lt;table&gt;. They keep working after menu changes; regenerate
        only if you move to a new domain.
      </p>
    </div>
  );
}
