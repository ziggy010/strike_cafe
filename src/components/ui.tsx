"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, Minus, Plus, X } from "lucide-react";
import type { Diet, OrderStatus, Stock } from "@/lib/types";

/** Indian-standard veg/non-veg mark: dot in a square. */
export function DietMark({ diet, className = "" }: { diet: Diet; className?: string }) {
  if (diet === "none") return null;
  const color = diet === "veg" ? "var(--color-pitch-bright)" : "var(--color-terracotta)";
  return (
    <span
      aria-label={diet === "veg" ? "Vegetarian" : "Non-vegetarian"}
      role="img"
      className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border-[1.5px] ${className}`}
      style={{ borderColor: color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function SpiceLevel({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (!level) return null;
  return (
    <span className="inline-flex items-center gap-0" aria-label={`Spice level ${level} of 3`} role="img">
      {Array.from({ length: level }).map((_, i) => (
        <Flame key={i} size={12} className="text-terracotta" fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

export function StockBadge({ stock, soldOut, fewLeft }: { stock: Stock; soldOut: string; fewLeft: string }) {
  if (stock === "in") return null;
  if (stock === "out") {
    return (
      <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
        {soldOut}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-saffron-deep">
      {fewLeft}
    </span>
  );
}

export function Stepper({
  qty,
  onChange,
  min = 1,
}: {
  qty: number;
  onChange: (q: number) => void;
  min?: number;
}) {
  return (
    <div className="inline-flex items-center rounded-ctl border border-line bg-surface transition-shadow focus-within:shadow-lift">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(min, qty - 1))}
        disabled={qty <= min}
        className="pressable flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink disabled:opacity-35 disabled:active:scale-100"
      >
        <Minus size={18} />
      </button>
      <span key={qty} className="tabular w-8 animate-pop-in text-center text-base font-bold">{qty}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(qty + 1)}
        className="pressable flex h-11 w-11 items-center justify-center text-ink-soft hover:text-ink"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}

/** Bottom sheet with scrim; closes on scrim tap and Escape. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  const closeWithMotion = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      onClose();
      setClosing(false);
    }, 220);
  }, [closing, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeWithMotion();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [closeWithMotion, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        aria-label="Close"
        onClick={closeWithMotion}
        className={`absolute inset-0 bg-ink/45 transition-colors hover:bg-ink/50 ${closing ? "sheet-scrim-out" : "sheet-scrim-in"}`}
      />
      <div
        ref={ref}
        className={`relative w-full max-w-md overflow-hidden rounded-t-[24px] bg-surface shadow-sheet ${closing ? "sheet-panel-out" : "sheet-panel-in"}`}
        style={{ maxHeight: "88dvh" }}
      >
        {title ? (
          <div className="flex items-center justify-between px-5 pt-4 pb-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              aria-label="Close"
              onClick={closeWithMotion}
              className="pressable -mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-cream hover:text-ink"
            >
              <X size={20} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label="Close"
            onClick={closeWithMotion}
            className="pressable absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-surface/92 text-ink-soft shadow-lift hover:bg-surface hover:text-ink"
          >
            <X size={19} />
          </button>
        )}
        <div
          className={`overflow-y-auto ${title ? "px-5" : ""} pb-[max(1.25rem,env(safe-area-inset-bottom))]`}
          style={{ maxHeight: title ? "calc(88dvh - 60px)" : "88dvh" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export const STATUS_STYLES: Record<OrderStatus, { bg: string; text: string }> = {
  received: { bg: "bg-ink/8", text: "text-ink" },
  preparing: { bg: "bg-saffron-soft", text: "text-saffron-deep" },
  ready: { bg: "bg-pitch-soft", text: "text-pitch-bright" },
  served: { bg: "bg-ink/6", text: "text-ink-faint" },
  cancelled: { bg: "bg-terracotta-soft", text: "text-terracotta" },
};

export function StatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${s.bg} ${s.text}`}>
      {label}
    </span>
  );
}
