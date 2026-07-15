"use client";

import { useState } from "react";
import { Banknote, Download, QrCode, ReceiptText, TrendingUp } from "lucide-react";
import { useArchive, useDB } from "@/lib/useStore";
import { npr } from "@/lib/format";
import { linesSubtotal, orderTotal } from "@/lib/orders";

type Period = "today" | "7d" | "30d";

export default function ReportsPage() {
  const db = useDB();
  const archive = useArchive();
  const [period, setPeriod] = useState<Period>("today");

  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  if (period === "7d") sinceDate.setDate(sinceDate.getDate() - 6);
  if (period === "30d") sinceDate.setDate(sinceDate.getDate() - 29);
  const since = sinceDate.getTime();

  // Live board holds today's + still-open orders; archive holds closed past-day
  // orders. They're disjoint, so a plain concat is safe.
  const allOrders = period === "today" ? db.orders : [...db.orders, ...archive];

  // Revenue counts served orders; cancelled are tracked separately.
  const orders = allOrders.filter((o) => o.placedAt >= since && o.status !== "cancelled");
  const served = orders.filter((o) => o.status === "served");
  const cancelled = allOrders.filter((o) => o.placedAt >= since && o.status === "cancelled");

  const revenue = served.reduce((n, o) => n + orderTotal(o), 0);
  const grossSales = served.reduce((n, o) => n + linesSubtotal(o.lines), 0);
  const discountsGiven = served.reduce((n, o) => n + (o.discount?.amount ?? 0), 0);
  const avgTicket = served.length ? Math.round(revenue / served.length) : 0;
  const paidServed = served.filter((o) => o.paid);
  const unpaidServed = served.filter((o) => !o.paid);
  const cashRevenue = paidServed.filter((o) => o.paymentMethod === "cash").reduce((n, o) => n + orderTotal(o), 0);
  const qrRevenue = paidServed.filter((o) => o.paymentMethod === "counter-qr").reduce((n, o) => n + orderTotal(o), 0);
  const uncollectedServed = unpaidServed.reduce((n, o) => n + orderTotal(o), 0);
  const ratings = served.filter((o) => o.feedback).map((o) => o.feedback!.rating);
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;

  // Best sellers
  const salesMap = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of served) {
    for (const l of o.lines) {
      const e = salesMap.get(l.itemId) ?? { name: l.name, qty: 0, revenue: 0 };
      e.qty += l.qty;
      e.revenue += l.qty * l.price;
      salesMap.set(l.itemId, e);
    }
  }
  const bySales = [...salesMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

  // Revenue by category
  const itemCat = new Map(db.items.map((i) => [i.id, i.categoryId]));
  const catName = new Map(db.categories.map((c) => [c.id, c.name]));
  const catMap = new Map<string, number>();
  for (const o of served) {
    for (const l of o.lines) {
      const name = catName.get(itemCat.get(l.itemId) ?? "") ?? "Other";
      catMap.set(name, (catMap.get(name) ?? 0) + l.qty * l.price);
    }
  }
  const byCategory = [...catMap.entries()].sort((a, b) => b[1] - a[1]);

  // Peak hours (order placement counts, open + served)
  const byHour = Array.from({ length: 15 }, (_, i) => i + 7).map((h) => ({
    hour: h,
    count: orders.filter((o) => new Date(o.placedAt).getHours() === h).length,
    revenue: served.filter((o) => new Date(o.placedAt).getHours() === h).reduce((n, o) => n + orderTotal(o), 0),
  })); // 7:00–21:00
  const peakHour = byHour.reduce((best, cur) => (cur.count > best.count ? cur : best), byHour[0]);
  const completionRate = orders.length ? Math.round((served.length / orders.length) * 100) : 0;

  // Staff performance: orders served/closed per staff member
  const staffMap = new Map<string, number>();
  for (const o of served) {
    if (o.servedBy) staffMap.set(o.servedBy, (staffMap.get(o.servedBy) ?? 0) + 1);
  }
  const byStaff = [...staffMap.entries()]
    .map(([id, count]) => ({ name: db.staff.find((u) => u.id === id)?.name ?? "Former staff", count }))
    .sort((a, b) => b.count - a.count);

  const exportCSV = () => {
    const rows = [
      ["code", "table", "placed_at", "status", "paid", "payment_method", "items", "gross_npr", "discount_code", "discount_npr", "net_npr", "rating"],
      ...allOrders
        .filter((o) => o.placedAt >= since)
        .map((o) => [
          o.code,
          db.tables.find((t) => t.id === o.tableId)?.label ?? "?",
          new Date(o.placedAt).toISOString(),
          o.status,
          o.paid ? "yes" : "no",
          o.paymentMethod ?? "",
          o.lines.map((l) => `${l.qty}x ${l.name}`).join("; "),
          String(linesSubtotal(o.lines)),
          o.discount?.code ?? "",
          String(o.discount?.amount ?? 0),
          String(orderTotal(o)),
          o.feedback ? String(o.feedback.rating) : "",
        ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `strike-yard-orders-${period}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-pitch">Reports</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {period === "today" ? "Today" : period === "7d" ? "Last 7 days" : "Last 30 days"} closeout, sales, payments, and menu performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-ctl border border-line bg-surface p-0.5 text-sm font-bold">
            {(
              [
                ["today", "Today"],
                ["7d", "7 days"],
                ["30d", "30 days"],
              ] as [Period, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setPeriod(v)}
                aria-pressed={period === v}
                className={`rounded-[8px] px-3.5 py-2 transition-colors ${period === v ? "bg-pitch text-cream" : "text-ink-soft"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-ctl border border-pitch/30 px-3.5 py-2.5 text-sm font-bold text-pitch"
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* Headline numbers */}
      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Net sales" value={npr(revenue)} sub={grossSales !== revenue ? `${npr(grossSales)} before promos` : "served orders"} />
        <Metric label="Orders served" value={String(served.length)} sub={`${completionRate}% complete${cancelled.length ? ` · ${cancelled.length} cancelled` : ""}`} />
        <Metric
          label="Average ticket"
          value={served.length ? npr(avgTicket) : "—"}
          sub={discountsGiven > 0 ? `${npr(discountsGiven)} in promos` : undefined}
        />
        <Metric label="Customer rating" value={avgRating ? `${avgRating} / 5` : "—"} sub={ratings.length ? `${ratings.length} ratings` : "no ratings yet"} />
      </dl>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-card border border-line bg-surface p-4 shadow-lift" aria-label="Payment split">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg">Payment split</h2>
            <span className="rounded-full bg-pitch-soft px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-pitch">
              {npr(cashRevenue + qrRevenue)} collected
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <PaymentMetric icon="cash" label="Cash" value={cashRevenue} />
            <PaymentMetric icon="qr" label="Counter QR" value={qrRevenue} />
            <PaymentMetric icon="due" label="Served, unpaid" value={uncollectedServed} danger />
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface p-4 shadow-lift" aria-label="Shift pulse">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-pitch" />
            <h2 className="font-display text-lg">Shift pulse</h2>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-bold uppercase tracking-wide text-ink-faint text-xs">Peak hour</dt>
              <dd className="price mt-1 font-display text-xl">{peakHour.count ? `${peakHour.hour}:00` : "—"}</dd>
              <dd className="text-xs text-ink-faint">{peakHour.count ? `${peakHour.count} orders` : "No demand yet"}</dd>
            </div>
            <div>
              <dt className="font-bold uppercase tracking-wide text-ink-faint text-xs">Open now</dt>
              <dd className="price mt-1 font-display text-xl">{orders.filter((o) => o.status !== "served").length}</dd>
              <dd className="text-xs text-ink-faint">active or unpaid flow</dd>
            </div>
          </dl>
        </section>
      </div>

      {served.length === 0 && orders.length === 0 ? (
        <p className="mt-14 text-center text-ink-faint">
          No orders in this period yet. Reports fill in as orders are served.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-label="Best sellers">
            <h2 className="font-display text-lg">Best sellers</h2>
            <BarList
              rows={bySales.map((s) => ({ label: s.name, value: s.revenue, detail: `${s.qty} sold · ${npr(s.revenue)}` }))}
              empty="Nothing served yet."
            />
          </section>

          <section aria-label="Revenue by category">
            <h2 className="font-display text-lg">Revenue by category</h2>
            <BarList
              rows={byCategory.map(([label, v]) => ({ label, value: v, detail: npr(v) }))}
              empty="Nothing served yet."
            />
          </section>

          <section aria-label="Peak hours">
            <h2 className="font-display text-lg">Peak hours</h2>
            <div className="mt-3 flex h-44 items-end gap-1 rounded-card border border-line bg-surface p-4">
              {byHour.map(({ hour, count }) => {
                const max = Math.max(1, ...byHour.map((x) => x.count));
                return (
                  <div key={hour} className="flex flex-1 flex-col items-center gap-1" title={`${count} orders at ${hour}:00`}>
                    <div
                      className={`w-full rounded-t-[3px] transition-colors ${count > 0 ? "bg-pitch-bright" : "bg-line-soft"}`}
                      style={{ height: `${Math.max(4, (count / max) * 112)}px` }}
                    />
                    <span className="tabular text-[10px] text-ink-faint">{hour}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">
              Orders placed per hour, 7:00 to 21:00. Peak: {peakHour.count ? `${peakHour.hour}:00 with ${peakHour.count} orders and ${npr(peakHour.revenue)}` : "no orders yet"}.
            </p>
          </section>

          <section aria-label="Staff performance">
            <h2 className="font-display text-lg">Orders served by staff</h2>
            <BarList
              rows={byStaff.map((s) => ({ label: s.name, value: s.count, detail: `${s.count} orders` }))}
              empty="No served orders attributed yet — staff are recorded when they tap “Mark served”."
            />
          </section>
        </div>
      )}
    </div>
  );
}

function PaymentMetric({
  icon,
  label,
  value,
  danger,
}: {
  icon: "cash" | "qr" | "due";
  label: string;
  value: number;
  danger?: boolean;
}) {
  const Icon = icon === "cash" ? Banknote : icon === "qr" ? QrCode : ReceiptText;
  return (
    <div className={`rounded-ctl border px-3 py-3 ${danger ? "border-terracotta/30 bg-terracotta-soft" : "border-line bg-cream"}`}>
      <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${danger ? "text-terracotta" : "text-ink-faint"}`}>
        <Icon size={14} /> {label}
      </p>
      <p className="price mt-1 font-display text-xl text-ink">{value ? npr(value) : "—"}</p>
    </div>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className="price mt-1 font-display text-xl">{value}</dd>
      {sub && <dd className="text-xs text-ink-faint">{sub}</dd>}
    </div>
  );
}

function BarList({
  rows,
  empty,
}: {
  rows: { label: string; value: number; detail: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="mt-3 rounded-card border border-line bg-surface p-4 text-sm text-ink-faint">{empty}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="mt-3 space-y-2.5 rounded-card border border-line bg-surface p-4">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-bold">{r.label}</span>
            <span className="price shrink-0 text-ink-soft">{r.detail}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-cream">
            <div
              className="h-2 rounded-full bg-pitch-bright"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
