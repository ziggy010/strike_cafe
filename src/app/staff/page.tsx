"use client";

import { useMemo, useState } from "react";
import { BellRing, Check, ChevronRight, QrCode } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { StatusBadge } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { clockTime, npr, timeAgo } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { isOpen } from "@/lib/types";

const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  received: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "served", label: "Mark served" },
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const db = useDB();
  const user = useStaff();
  const [tab, setTab] = useState<"open" | "closed">("open");

  const calls = db.calls.filter((c) => !c.resolvedAt);
  const tableLabel = (id: string) => db.tables.find((t) => t.id === id)?.label ?? "?";

  const open = useMemo(
    () =>
      db.orders
        .filter(isOpen)
        .sort((a, b) => a.placedAt - b.placedAt),
    [db.orders],
  );
  const closed = useMemo(
    () =>
      db.orders
        .filter((o) => !isOpen(o))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 30),
    [db.orders],
  );

  const orders = tab === "open" ? open : closed;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl text-pitch">Orders</h1>
        <div className="flex rounded-ctl border border-line bg-surface p-0.5 text-sm font-bold">
          {(["open", "closed"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setTab(v)}
              aria-pressed={tab === v}
              className={`pressable rounded-[8px] px-4 py-2 capitalize ${
                tab === v ? "bg-pitch text-cream" : "text-ink-soft"
              }`}
            >
              {v} {v === "open" && open.length > 0 && `(${open.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Waiter calls */}
      {calls.length > 0 && (
        <section aria-label="Waiter calls" className="mt-4 space-y-2">
          {calls.map((c) => (
            <div
              key={c.id}
              className="flex animate-ticket-in items-center justify-between rounded-card border border-saffron-deep/30 bg-saffron-soft px-4 py-3"
            >
              <p className="flex items-center gap-2 font-bold text-saffron-deep">
                <BellRing size={18} />
                Table {tableLabel(c.tableId)} is calling · {timeAgo(c.createdAt)}
              </p>
              <button
                type="button"
                onClick={() => getStore().resolveCall(c.id, user.id)}
                className="flex items-center gap-1.5 rounded-ctl bg-saffron-deep px-3.5 py-2 text-sm font-bold text-cream"
              >
                <Check size={15} /> On it
              </button>
            </div>
          ))}
        </section>
      )}

      {orders.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="font-bold text-ink-soft">
            {tab === "open" ? "No open orders" : "No past orders yet"}
          </p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-faint">
            <QrCode size={15} />
            {tab === "open" ? "New orders appear here the moment a customer sends them." : "Served and cancelled orders land here."}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} tableLabel={tableLabel(o.tableId)} userId={user.id} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderCard({ order, tableLabel, userId }: { order: Order; tableLabel: string; userId: string }) {
  const [expanded, setExpanded] = useState(isOpen(order));
  const total = order.lines.reduce((n, l) => n + l.qty * l.price, 0);
  const next = NEXT_STATUS[order.status];
  const store = getStore();

  return (
    <li className={`rounded-card border bg-surface shadow-lift ${order.status === "received" ? "border-pitch-bright/50" : "border-line"}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="pressable flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-cream/60"
      >
        <span className="flex min-h-11 min-w-11 max-w-28 shrink-0 items-center justify-center rounded-ctl bg-pitch-soft px-2 text-center font-display text-base leading-tight text-pitch">
          {tableLabel}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-bold">{order.code}</span>
            <StatusBadge status={order.status} label={STATUS_LABEL[order.status]} />
            {order.batches > 1 && (
              <span className="rounded-full bg-pitch-soft px-2 py-0.5 text-xs font-bold text-pitch">
                +{order.batches - 1} round{order.batches > 2 ? "s" : ""}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-ink-soft">
            {order.lines.reduce((n, l) => n + l.qty, 0)} items · {clockTime(order.placedAt)} · {timeAgo(order.placedAt)}
          </span>
        </span>
        <span className="price font-display text-lg">{npr(total)}</span>
        <span className={`flex items-center gap-1 text-xs font-bold ${order.paid ? "text-pitch-bright" : "text-terracotta"}`}>
          {order.paid ? "PAID" : "UNPAID"}
        </span>
        <ChevronRight size={18} className={`shrink-0 text-ink-faint transition-transform ${expanded ? "rotate-90" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-line-soft px-4 pt-3 pb-4">
          <ul className="space-y-1.5">
            {order.lines.map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span>
                  <span className="tabular font-bold">{l.qty}×</span> {l.name}
                  {l.batch > 1 && <span className="ml-1.5 text-xs font-bold text-pitch-bright">R{l.batch}</span>}
                  {l.note && <span className="block pl-6 text-saffron-deep">“{l.note}”</span>}
                </span>
                <span className="price shrink-0 text-ink-soft">{npr(l.price * l.qty)}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            {next && (
              <button
                type="button"
                onClick={() => store.setOrderStatus(order.id, next.to, userId)}
                className="pressable tap-bloom rounded-ctl bg-pitch px-4 py-2.5 text-sm font-bold text-cream hover:bg-pitch-deep"
              >
                {next.label}
              </button>
            )}
            {isOpen(order) && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Cancel order ${order.code}? This can't be undone.`)) {
                    store.setOrderStatus(order.id, "cancelled", userId);
                  }
                }}
                className="pressable ml-auto rounded-ctl px-3 py-2.5 text-sm font-bold text-terracotta hover:bg-terracotta-soft"
              >
                Cancel order
              </button>
            )}
          </div>

          {order.feedback && (
            <p className="mt-3 rounded-ctl bg-cream px-3 py-2 text-sm text-ink-soft">
              Customer rating: <span className="font-bold text-saffron-deep">{order.feedback.rating}/5</span>
              {order.feedback.comment && <> — “{order.feedback.comment}”</>}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
