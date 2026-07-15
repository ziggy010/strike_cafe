"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, ChevronRight, Clock3, QrCode, UserCheck } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { StatusBadge } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { clockTime, npr, timeAgo } from "@/lib/format";
import { linesSubtotal, orderTotal } from "@/lib/orders";
import type { Order, OrderStatus, WaiterCall } from "@/lib/types";
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
  const [now, setNow] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const calls = useMemo(
    () =>
      db.calls
        .filter((c) => !c.resolvedAt)
        .sort((a, b) => Number(!!a.acceptedAt) - Number(!!b.acceptedAt) || a.createdAt - b.createdAt),
    [db.calls],
  );
  const tableLabel = (id: string) => db.tables.find((t) => t.id === id)?.label ?? "?";
  const staffName = (id: string | null) => (id ? db.staff.find((s) => s.id === id)?.name ?? "Staff" : "Staff");

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
            <WaiterCallCard
              key={c.id}
              call={c}
              now={now}
              staffName={staffName}
              tableLabel={tableLabel(c.tableId)}
              userId={user.id}
            />
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

function WaiterCallCard({
  call,
  now,
  staffName,
  tableLabel,
  userId,
}: {
  call: WaiterCall;
  now: number;
  staffName: (id: string | null) => string;
  tableLabel: string;
  userId: string;
}) {
  const store = getStore();
  const claimed = !!call.acceptedAt;
  const ageMin = now ? Math.max(0, Math.floor((now - call.createdAt) / 60000)) : 0;
  const urgent = !claimed && ageMin >= 2;

  return (
    <div
      className={`animate-ticket-in rounded-card border px-4 py-3 shadow-lift ${
        urgent
          ? "border-terracotta/45 bg-terracotta-soft"
          : claimed
            ? "border-pitch-bright/30 bg-pitch-soft"
            : "border-saffron-deep/30 bg-saffron-soft"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 font-bold ${claimed ? "text-pitch" : urgent ? "text-terracotta" : "text-saffron-deep"}`}>
            {claimed ? <UserCheck size={18} /> : <BellRing size={18} />}
            Table {tableLabel} needs staff
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1">
              <Clock3 size={14} />
              Waiting {ageMin < 1 ? "under 1 min" : `${ageMin} min`}
            </span>
            <span>{claimed ? `${staffName(call.acceptedBy)} is going` : `New call, ${timeAgo(call.createdAt)}`}</span>
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          {!claimed ? (
            <button
              type="button"
              onClick={() => store.acceptCall(call.id, userId)}
              className="pressable flex items-center justify-center gap-1.5 rounded-ctl bg-saffron-deep px-4 py-2.5 text-sm font-bold text-cream"
            >
              <UserCheck size={15} /> Going
            </button>
          ) : (
            <button
              type="button"
              onClick={() => store.resolveCall(call.id, userId)}
              className="pressable flex items-center justify-center gap-1.5 rounded-ctl bg-pitch px-4 py-2.5 text-sm font-bold text-cream"
            >
              <Check size={15} /> Resolved
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, tableLabel, userId }: { order: Order; tableLabel: string; userId: string }) {
  const [expanded, setExpanded] = useState(isOpen(order));
  const total = orderTotal(order);
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

          {order.discount && (
            <div className="price mt-2 flex items-center justify-between border-t border-line-soft pt-2 text-sm">
              <span className="font-bold text-pitch">Promo {order.discount.code}</span>
              <span className="text-ink-soft">
                −{npr(order.discount.amount)} · was {npr(linesSubtotal(order.lines))}
              </span>
            </div>
          )}

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
