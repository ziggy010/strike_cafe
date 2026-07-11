"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { useDB } from "@/lib/useStore";
import { npr } from "@/lib/format";
import type { Order } from "@/lib/types";

type Period = "today" | "7d" | "30d";

export default function ReportsPage() {
  const db = useDB();
  const [period, setPeriod] = useState<Period>("today");

  const sinceDate = new Date();
  sinceDate.setHours(0, 0, 0, 0);
  if (period === "7d") sinceDate.setDate(sinceDate.getDate() - 6);
  if (period === "30d") sinceDate.setDate(sinceDate.getDate() - 29);
  const since = sinceDate.getTime();

  // Revenue counts served orders; cancelled are tracked separately.
  const orders = db.orders.filter((o) => o.placedAt >= since && o.status !== "cancelled");
  const served = orders.filter((o) => o.status === "served");
  const cancelled = db.orders.filter((o) => o.placedAt >= since && o.status === "cancelled");

  const orderTotal = (o: Order) => o.lines.reduce((n, l) => n + l.qty * l.price, 0);
  const revenue = served.reduce((n, o) => n + orderTotal(o), 0);
  const avgTicket = served.length ? Math.round(revenue / served.length) : 0;
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
  const bySales = [...salesMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 8);

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
  })); // 7:00–21:00

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
      ["code", "table", "placed_at", "status", "paid", "payment_method", "items", "total_npr", "rating"],
      ...db.orders
        .filter((o) => o.placedAt >= since)
        .map((o) => [
          o.code,
          db.tables.find((t) => t.id === o.tableId)?.label ?? "?",
          new Date(o.placedAt).toISOString(),
          o.status,
          o.paid ? "yes" : "no",
          o.paymentMethod ?? "",
          o.lines.map((l) => `${l.qty}x ${l.name}`).join("; "),
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-pitch">Reports</h1>
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
        <Metric label="Revenue (served)" value={npr(revenue)} />
        <Metric label="Orders served" value={String(served.length)} sub={cancelled.length ? `${cancelled.length} cancelled` : undefined} />
        <Metric label="Average ticket" value={served.length ? npr(avgTicket) : "—"} />
        <Metric label="Customer rating" value={avgRating ? `${avgRating} / 5` : "—"} sub={ratings.length ? `${ratings.length} ratings` : "no ratings yet"} />
      </dl>

      {served.length === 0 && orders.length === 0 ? (
        <p className="mt-14 text-center text-ink-faint">
          No orders in this period yet. Reports fill in as orders are served.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section aria-label="Best sellers">
            <h2 className="font-display text-lg">Best sellers</h2>
            <BarList
              rows={bySales.map((s) => ({ label: s.name, value: s.qty, detail: `${s.qty} sold · ${npr(s.revenue)}` }))}
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
            <div className="mt-3 flex h-36 items-end gap-1 rounded-card border border-line bg-surface p-4">
              {byHour.map(({ hour, count }) => {
                const max = Math.max(1, ...byHour.map((x) => x.count));
                return (
                  <div key={hour} className="flex flex-1 flex-col items-center gap-1" title={`${count} orders at ${hour}:00`}>
                    <div
                      className={`w-full rounded-t-[3px] ${count > 0 ? "bg-pitch-bright" : "bg-line-soft"}`}
                      style={{ height: `${Math.max(3, (count / max) * 88)}px` }}
                    />
                    <span className="tabular text-[10px] text-ink-faint">{hour}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">Orders placed per hour (7:00–21:00)</p>
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
