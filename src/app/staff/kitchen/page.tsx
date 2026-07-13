"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChefHat, Clock3, Flame, TimerReset } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { elapsed } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";

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

  const summary = useMemo(() => {
    const waiting = tickets.filter((ticket) => ticket.status === "received").length;
    const preparing = tickets.filter((ticket) => ticket.status === "preparing").length;
    const ready = tickets.filter((ticket) => ticket.status === "ready").length;
    const oldest = tickets.length ? Math.max(0, Math.floor((now - tickets[0].placedAt) / 60000)) : 0;
    const urgent = tickets.filter((ticket) => ticket.status !== "ready" && now - ticket.placedAt >= 10 * 60000).length;
    return { waiting, preparing, ready, oldest, urgent };
  }, [tickets, now]);

  useEffect(() => {
    if (summary.urgent === 0) return;
    const id = window.setInterval(kitchenUrgentChime, 45000);
    return () => window.clearInterval(id);
  }, [summary.urgent]);

  const tableLabel = (id: string) => db.tables.find((t) => t.id === id)?.label ?? "?";
  const inStaffShell = user.role !== "kitchen";

  return (
    <div className={`${inStaffShell ? "min-h-full rounded-card lg:m-4" : "min-h-dvh"} bg-kds-bg text-kds-text`}>
      <header className="border-b border-kds-line px-5 py-3">
        <div className="flex items-center justify-between gap-4">
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
        </div>

        {tickets.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm font-bold">
            <SummaryPill label="Waiting" value={summary.waiting} tone="amber" />
            <SummaryPill label="Preparing" value={summary.preparing} tone="green" />
            <SummaryPill label="Ready" value={summary.ready} tone="neutral" />
            <SummaryPill label="Oldest" value={`${summary.oldest}m`} tone={summary.oldest >= 10 ? "red" : "neutral"} />
            {summary.urgent > 0 && <SummaryPill label="Urgent" value={summary.urgent} tone="red" />}
          </div>
        )}
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

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "amber" | "green" | "red" | "neutral";
}) {
  const cls =
    tone === "amber"
      ? "border-saffron-deep/40 bg-saffron-deep/15 text-saffron"
      : tone === "green"
        ? "border-pitch-bright/35 bg-pitch-bright/15 text-pitch-bright"
        : tone === "red"
          ? "border-terracotta/50 bg-terracotta/15 text-terracotta"
          : "border-kds-line bg-kds-raised text-kds-dim";

  return (
    <span className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 ${cls}`}>
      <span className="uppercase tracking-widest text-[10px] opacity-80">{label}</span>
      <span className="tabular text-base text-kds-text">{value}</span>
    </span>
  );
}

function ticketTone(order: Order, now: number): "normal" | "warning" | "urgent" | "ready" {
  if (order.status === "ready") return "ready";
  const ageMin = (now - order.placedAt) / 60000;
  if (ageMin >= 10) return "urgent";
  if (ageMin >= 7) return "warning";
  return "normal";
}

function statusLabel(status: OrderStatus): string {
  if (status === "received") return "Waiting";
  if (status === "preparing") return "Cooking";
  if (status === "ready") return "Ready";
  return status;
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
  const tone = ticketTone(order, now);
  const store = getStore();

  const action =
    order.status === "received"
      ? { label: "START", to: "preparing" as const, cls: "bg-saffron-deep text-kds-bg" }
      : order.status === "preparing"
        ? { label: "READY", to: "ready" as const, cls: "bg-pitch-bright text-kds-bg" }
        : { label: "SERVED", to: "served" as const, cls: "bg-kds-raised text-kds-text border border-kds-line" };
  const ticketCls =
    tone === "urgent"
      ? "border-terracotta bg-[oklch(0.22_0.035_40)] shadow-[0_0_0_1px_oklch(0.58_0.14_40_/_0.35),0_16px_42px_oklch(0.12_0.03_40_/_0.5)]"
      : tone === "warning"
        ? "border-saffron-deep bg-[oklch(0.23_0.03_70)]"
        : tone === "ready"
          ? "border-pitch-bright/70 bg-[oklch(0.22_0.03_146)]"
          : "border-kds-line bg-kds-surface";

  return (
    <article
      className={`flex animate-ticket-in flex-col rounded-card border-2 ${ticketCls}`}
    >
      <header className="flex items-center justify-between rounded-t-[14px] bg-kds-raised px-4 py-3">
        <div>
          <p className="font-display text-3xl leading-none">{tableLabel}</p>
          <p
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black uppercase tracking-widest ${
              tone === "urgent"
                ? "bg-terracotta text-kds-bg"
                : tone === "warning"
                  ? "bg-saffron-deep text-kds-bg"
                  : tone === "ready"
                    ? "bg-pitch-bright text-kds-bg"
                    : "bg-kds-surface text-kds-dim"
            }`}
          >
            {tone === "urgent" && <Flame size={12} />}
            {statusLabel(order.status)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-kds-dim">{order.code}</p>
          <p
            className={`tabular flex items-center justify-end gap-1 text-xl font-black ${
              tone === "urgent" ? "text-terracotta" : tone === "warning" ? "text-saffron" : "text-kds-text"
            }`}
          >
            {tone === "urgent" ? <TimerReset size={17} /> : <Clock3 size={16} />}
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
                <p className="mb-2 mt-3 rounded-ctl border border-saffron-deep/45 bg-saffron-deep/15 px-2 py-1.5 text-xs font-black uppercase tracking-widest text-saffron">
                  Round {l.batch}, new items
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

function kitchenUrgentChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [220, 220, 196].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.16;
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.14);
    });
  } catch {
    // Browsers may block audio until staff interact with the page.
  }
}
