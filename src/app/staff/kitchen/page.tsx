"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChefHat, Flame } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { elapsed } from "@/lib/format";
import type { Order } from "@/lib/types";

/**
 * Kitchen Display System: dark, huge type, three-step flow.
 * Tickets age visually — border warms up after 10 minutes.
 */
export default function KitchenPage() {
  const db = useDB();
  const user = useStaff();

  // 1s clock so elapsed timers stay live
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const tickets = useMemo(
    () =>
      db.orders
        .filter((o) => o.status === "received" || o.status === "preparing" || o.status === "ready")
        .sort((a, b) => a.placedAt - b.placedAt),
    [db.orders],
  );

  const tableLabel = (id: string) => db.tables.find((t) => t.id === id)?.label ?? "?";
  const inStaffShell = user.role !== "kitchen";

  return (
    <div className={`${inStaffShell ? "min-h-full rounded-card lg:m-4" : "min-h-dvh"} bg-kds-bg text-kds-text`}>
      <header className="flex items-center justify-between border-b border-kds-line px-5 py-3">
        <div className="flex items-center gap-3">
          {inStaffShell && (
            <Link
              href="/staff"
              aria-label="Back to orders"
              className="pressable flex h-10 items-center gap-2 rounded-ctl border border-kds-line px-3 text-sm font-bold text-kds-dim hover:text-kds-text"
            >
              <ArrowLeft size={20} />
              Orders
            </Link>
          )}
          <h1 className="flex items-center gap-2 font-display text-xl">
            <ChefHat size={22} /> Kitchen
          </h1>
        </div>
        <p className="tabular text-sm font-bold text-kds-dim">
          {tickets.length} open ticket{tickets.length === 1 ? "" : "s"}
        </p>
      </header>

      {tickets.length === 0 ? (
        <div className="flex min-h-[70dvh] flex-col items-center justify-center text-kds-dim">
          <ChefHat size={44} />
          <p className="mt-3 text-xl font-bold">All clear</p>
          <p className="mt-1 text-sm">New tickets appear here automatically.</p>
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {tickets.map((o) => (
            <Ticket key={o.id} order={o} tableLabel={tableLabel(o.tableId)} userId={user.id} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function Ticket({
  order,
  tableLabel,
  userId,
  now,
}: {
  order: Order;
  tableLabel: string;
  userId: string;
  now: number;
}) {
  const ageMin = (now - order.placedAt) / 60000;
  const urgent = ageMin > 10 && order.status !== "ready";
  const store = getStore();

  const action =
    order.status === "received"
      ? { label: "START", to: "preparing" as const, cls: "bg-saffron-deep text-kds-bg" }
      : order.status === "preparing"
        ? { label: "READY", to: "ready" as const, cls: "bg-pitch-bright text-kds-bg" }
        : { label: "SERVED", to: "served" as const, cls: "bg-kds-raised text-kds-text border border-kds-line" };

  return (
    <article
      className={`flex animate-ticket-in flex-col rounded-card border-2 bg-kds-surface ${
        urgent ? "border-terracotta" : order.status === "ready" ? "border-pitch-bright/60" : "border-kds-line"
      }`}
    >
      <header className="flex items-center justify-between rounded-t-[14px] bg-kds-raised px-4 py-3">
        <p className="font-display text-2xl">{tableLabel}</p>
        <div className="text-right">
          <p className="text-sm font-bold text-kds-dim">{order.code}</p>
          <p className={`tabular text-lg font-bold ${urgent ? "text-terracotta" : ""}`}>
            {elapsed(order.placedAt, now)}
          </p>
        </div>
      </header>

      <ul className="flex-1 space-y-2.5 px-4 py-3.5">
        {order.lines.map((l, i) => {
          const prevBatch = i > 0 ? order.lines[i - 1].batch : 1;
          return (
            <li key={i}>
              {l.batch > 1 && l.batch !== prevBatch && (
                <p className="mb-1.5 border-t border-dashed border-kds-line pt-2 text-xs font-bold uppercase tracking-widest text-saffron">
                  Round {l.batch} — new
                </p>
              )}
              <p className="text-xl font-bold leading-snug">
                <span className="tabular mr-2 inline-block min-w-8 text-saffron">{l.qty}×</span>
                {l.name}
              </p>
              {l.note && (
                <p className="mt-0.5 flex items-start gap-1.5 pl-10 text-base font-bold text-terracotta">
                  <Flame size={16} className="mt-1 shrink-0" />
                  {l.note}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => store.setOrderStatus(order.id, action.to, userId)}
        className={`pressable tap-bloom m-3 flex items-center justify-center gap-2 rounded-ctl py-4 text-lg font-bold tracking-wide ${action.cls}`}
      >
        <Check size={20} /> {action.label}
      </button>
    </article>
  );
}
