"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { BadgePercent, Banknote, CheckCircle2, Clock3, Copy, CreditCard, Printer, QrCode, ReceiptText, Search, Share2, Trash2 } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { StatusBadge } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { clockTime, npr, timeAgo } from "@/lib/format";
import { billCharges, linesSubtotal, orderTotal } from "@/lib/orders";
import { buildDynamicNepalQr } from "@/lib/nepalQr";
import { floorLabel, tableDisplay } from "@/lib/tables";
import type { Order, OrderStatus, Settings } from "@/lib/types";

type BillTab = "unpaid" | "paid";
type BillGroup = {
  id: string;
  tableId: string;
  tableLabel: string;
  floor: string;
  orders: Order[];
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Received",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
};

function groupTotal(group: BillGroup): number {
  return group.orders.reduce((sum, order) => sum + orderTotal(order), 0);
}

function groupItemsSubtotal(group: BillGroup): number {
  return group.orders.reduce((sum, order) => sum + linesSubtotal(order.lines), 0);
}

function paymentLabel(method: Order["paymentMethod"]): string {
  if (method === "cash") return "Cash";
  if (method === "counter-qr") return "Counter QR";
  return "Unpaid";
}

function buildReceiptText(group: BillGroup, settings: Settings): string {
  const itemsSubtotal = groupItemsSubtotal(group);
  const promoDiscount = group.orders.reduce((sum, order) => sum + (order.discount?.amount ?? 0), 0);
  const counterDiscount = group.orders.reduce((sum, order) => sum + (order.counterDiscount?.amount ?? 0), 0);
  const subtotal = groupTotal(group);
  const { service, vat, total } = billCharges(subtotal, settings);
  const allPaid = group.orders.every((order) => order.paid);
  const method = allPaid ? paymentLabel(group.orders.find((order) => order.paymentMethod)?.paymentMethod ?? null) : "Unpaid";
  const lines = group.orders.flatMap((order) =>
    order.lines.map((line) => `${line.qty}x ${line.name} (${order.code}) ${npr(line.qty * line.price)}`),
  );

  return [
    settings.cafeName,
    `${group.floor} / ${group.tableLabel}`,
    `Orders: ${group.orders.map((order) => order.code).join(", ")}`,
    "",
    ...lines,
    "",
    promoDiscount > 0 || counterDiscount > 0 ? `Items subtotal: ${npr(itemsSubtotal)}` : null,
    promoDiscount > 0 ? `Promo discount: -${npr(promoDiscount)}` : null,
    counterDiscount > 0 ? `Bill discount: -${npr(counterDiscount)}` : null,
    service > 0 || vat > 0 ? `Subtotal after discount: ${npr(subtotal)}` : null,
    service > 0 ? `Service (${settings.serviceChargePercent}%): ${npr(service)}` : null,
    vat > 0 ? `VAT (${settings.vatPercent}%): ${npr(vat)}` : null,
    `Total: ${npr(total)}`,
    `Status: ${allPaid ? `Paid by ${method}` : "Payment due"}`,
    "",
    "Thank you for visiting Strike Yard.",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function BillingPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">Loading billing...</p>}>
      <BillingRoute />
    </Suspense>
  );
}

function BillingRoute() {
  const tableId = useSearchParams().get("table");
  return <Billing key={tableId} tableId={tableId} />;
}

function Billing({ tableId }: { tableId: string | null }) {
  const db = useDB();
  const { role } = useStaff();
  const [tab, setTab] = useState<BillTab>("unpaid");
  const [query, setQuery] = useState("");
  const tableLabel = (id: string) => db.tables.find((t) => t.id === id)?.label ?? "?";
  const scopedTable = db.tables.find((table) => table.id === tableId);

  const billable = useMemo(
    () =>
      db.orders
        .filter((order) => order.status === "served" && (!tableId || order.tableId === tableId))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [db.orders, tableId],
  );
  const unpaid = billable.filter((order) => !order.paid);
  const paid = billable.filter((order) => order.paid).slice(0, 40);
  const groups = (() => {
    const source = tab === "unpaid" ? unpaid : paid;
    const byTable = new Map<string, BillGroup>();
    for (const order of source) {
      const existing = byTable.get(order.tableId);
      if (existing) {
        existing.orders.push(order);
      } else {
        byTable.set(order.tableId, {
          id: `${tab}-${order.tableId}`,
          tableId: order.tableId,
          tableLabel: tableLabel(order.tableId),
          floor: floorLabel(db.tables.find((table) => table.id === order.tableId)?.floor),
          orders: [order],
        });
      }
    }
    return [...byTable.values()]
      .map((group) => ({
        ...group,
        orders: group.orders.sort((a, b) => a.placedAt - b.placedAt),
      }))
      .sort((a, b) => Math.max(...b.orders.map((order) => order.updatedAt)) - Math.max(...a.orders.map((order) => order.updatedAt)));
  })();

  const visible = groups.filter((group) => {
    const haystack = `${group.tableLabel} ${group.orders.map((order) => `${order.code} ${order.lines.map((line) => line.name).join(" ")}`).join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visible.find((group) => group.id === selectedId) ?? visible[0] ?? null;

  if (role !== "admin" && role !== "counter") return <p className="p-6">Billing is for owner and counter staff.</p>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-pitch">Billing</h1>
          <p className="mt-1 text-sm text-ink-soft">Bills appear after food is marked served.</p>
          {tableId && (
            <p className="mt-2 flex flex-wrap gap-x-3 text-sm font-bold">
              <Link href={{ pathname: "/staff/tables", query: { table: tableId } }} className="text-pitch underline underline-offset-4">Back to tables</Link>
              <span>{scopedTable ? tableDisplay(scopedTable) : "Unknown table"}</span>
            </p>
          )}
        </div>
        <div className="flex rounded-ctl border border-line bg-surface p-0.5 text-sm font-bold">
          {(
            [
              ["unpaid", `Unpaid ${unpaid.length ? `(${unpaid.length})` : ""}`],
              ["paid", "Paid"],
            ] as [BillTab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              className={`pressable rounded-[8px] px-4 py-2 ${
                tab === value ? "bg-pitch text-cream" : "text-ink-soft"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="min-w-0">
          <label className="flex items-center gap-2 rounded-ctl border border-line bg-surface px-3.5 py-2.5">
            <Search size={17} className="text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search table, code, or item"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </label>

          {visible.length === 0 ? (
            <div className="mt-4 rounded-card border border-line bg-surface p-5 text-center">
              <ReceiptText className="mx-auto text-ink-faint" size={28} />
              <p className="mt-2 font-bold text-ink-soft">{tab === "unpaid" ? "No unpaid bills" : "No paid bills found"}</p>
              <p className="mt-1 text-sm text-ink-faint">
                {tab === "unpaid" ? "A bill appears after the order is marked served." : "Paid bills stay here for quick lookup."}
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {visible.map((group) => (
                <li key={group.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(group.id)}
                    className={`pressable w-full rounded-card border p-3.5 text-left shadow-lift ${
                      selected?.id === group.id
                        ? "border-pitch-bright bg-pitch-soft"
                        : "border-line bg-surface hover:-translate-y-0.5 hover:border-pitch-bright/50 hover:shadow-[0_10px_24px_oklch(0.24_0.02_155_/_0.12)]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="font-bold">
                          {group.floor} / {group.tableLabel} · {group.orders.length} order{group.orders.length === 1 ? "" : "s"}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-cream px-2 py-0.5 text-xs font-bold text-ink-soft">
                            {group.orders.map((order) => order.code).join(", ")}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${tab === "paid" ? "bg-pitch-soft text-pitch" : "bg-terracotta-soft text-terracotta"}`}>
                            {tab === "paid" ? "PAID" : "UNPAID"}
                          </span>
                        </span>
                      </span>
                      <span className="price shrink-0 font-display text-lg text-pitch">{npr(billCharges(groupTotal(group), db.settings).total)}</span>
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                      <Clock3 size={13} />
                      Latest {timeAgo(Math.max(...group.orders.map((order) => order.updatedAt)))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="min-w-0">
          {selected ? (
            <BillDetail key={selected.id} group={selected} />
          ) : (
            <div className="rounded-card border border-line bg-surface p-8 text-center text-ink-faint">
              Select an order to show the bill.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PaymentQr({
  staticData,
  amount,
  remark,
  billNumber,
}: {
  staticData: string;
  amount: number;
  remark: string;
  billNumber: string;
}) {
  const payload = useMemo(
    () => buildDynamicNepalQr(staticData, amount, remark, billNumber),
    [staticData, amount, remark, billNumber],
  );
  // Component is keyed on the payload at the call site, so a fresh mount (src
  // null) accompanies every amount change — no stale QR for the wrong total.
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!payload) return;
    let cancelled = false;
    QRCode.toDataURL(payload, { width: 360, margin: 1, color: { dark: "#1f3328", light: "#ffffff" } })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [payload]);

  if (!staticData) return null;

  if (!payload) {
    return (
      <p className="mt-4 rounded-ctl bg-terracotta-soft px-4 py-3 text-sm font-bold text-terracotta">
        Payment QR isn&apos;t set up correctly — check Settings → Payment QR.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2 rounded-card border border-line bg-surface p-4 print:break-inside-avoid">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`Scan to pay ${npr(amount)}`} width={200} height={200} className="h-44 w-44" />
      )}
      <p className="text-center text-sm font-bold text-ink">
        Scan to pay <span className="price font-display text-pitch">{npr(amount)}</span>
      </p>
      <p className="text-center text-xs text-ink-faint">eSewa · Khalti · any bank app — {remark}</p>
    </div>
  );
}

function BillDetail({ group }: { group: BillGroup }) {
  const db = useDB();
  const user = useStaff();
  const [copied, setCopied] = useState(false);
  const [discountMode, setDiscountMode] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const itemsSubtotal = groupItemsSubtotal(group);
  const promoDiscount = group.orders.reduce((sum, order) => sum + (order.discount?.amount ?? 0), 0);
  const counterDiscount = group.orders.reduce((sum, order) => sum + (order.counterDiscount?.amount ?? 0), 0);
  const subtotal = groupTotal(group);
  const { vat, service, total } = billCharges(subtotal, db.settings);
  const itemCount = group.orders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.qty, 0), 0);
  const allPaid = group.orders.every((order) => order.paid);
  const firstPlacedAt = Math.min(...group.orders.map((order) => order.placedAt));
  const latestUpdatedAt = Math.max(...group.orders.map((order) => order.updatedAt));
  const paymentMethod = group.orders.find((order) => order.paymentMethod)?.paymentMethod ?? null;
  const store = getStore();
  const canShare = typeof navigator !== "undefined" && "share" in navigator;
  const markGroupPaid = (method: "cash" | "counter-qr") => {
    const unpaid = group.orders.filter((order) => !order.paid);
    const unpaidSubtotal = unpaid.reduce((sum, order) => sum + orderTotal(order), 0);
    const unpaidService = Math.round((unpaidSubtotal * db.settings.serviceChargePercent) / 100);
    const unpaidVat = Math.round((unpaidSubtotal * db.settings.vatPercent) / 100);
    const amountToAllocate = unpaidSubtotal + unpaidService + unpaidVat;
    let allocated = 0;

    unpaid.forEach((order, index) => {
      const orderAmount = index === unpaid.length - 1
        ? amountToAllocate - allocated
        : Math.round((orderTotal(order) / Math.max(1, unpaidSubtotal)) * amountToAllocate);
      allocated += orderAmount;
      store.markPaid(order.id, method, user.id, orderAmount);
    });
  };
  const applyGroupDiscount = () => {
    const entered = Number(discountValue);
    if (!Number.isFinite(entered) || entered < 0) return;
    const unpaid = group.orders.filter((order) => !order.paid);
    const bases = unpaid.map((order) => Math.max(0, linesSubtotal(order.lines) - (order.discount?.amount ?? 0)));
    const available = bases.reduce((sum, value) => sum + value, 0);
    const desired = discountMode === "percent"
      ? Math.round((available * Math.min(100, entered)) / 100)
      : Math.min(available, Math.round(entered));
    const code = discountMode === "percent" ? `COUNTER ${Math.min(100, entered)}%` : "COUNTER";
    let allocated = 0;

    unpaid.forEach((order, index) => {
      const amount = index === unpaid.length - 1
        ? desired - allocated
        : Math.floor((bases[index] / Math.max(1, available)) * desired);
      allocated += amount;
      store.setCounterDiscount(order.id, amount > 0 ? { code, amount } : null);
    });
    setDiscountValue("");
  };
  const clearGroupDiscount = () => {
    group.orders.filter((order) => !order.paid).forEach((order) => store.setCounterDiscount(order.id, null));
  };
  const receiptText = buildReceiptText(group, db.settings);

  const printBill = () => {
    window.print();
  };

  const shareBill = async () => {
    setCopied(false);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${db.settings.cafeName} bill, Table ${group.tableLabel}`,
          text: receiptText,
        });
        return;
      }
      await navigator.clipboard.writeText(receiptText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(receiptText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        window.alert(receiptText);
      }
    }
  };

  return (
    <div className="receipt-print-area overflow-hidden rounded-card border border-line bg-surface shadow-lift">
      <div className="receipt-no-print flex flex-wrap items-center justify-between gap-2 border-b border-line bg-cream px-5 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Receipt actions</p>
          <p className="text-sm text-ink-soft">{allPaid ? "Ready to print or share." : "Collect payment, then print or share."}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={printBill}
            className="pressable flex items-center gap-1.5 rounded-ctl bg-pitch px-3.5 py-2 text-sm font-bold text-cream"
          >
            <Printer size={16} /> Print bill
          </button>
          <button
            type="button"
            onClick={shareBill}
            className="pressable flex items-center gap-1.5 rounded-ctl border border-pitch/30 px-3.5 py-2 text-sm font-bold text-pitch hover:bg-pitch-soft"
          >
            {canShare ? <Share2 size={16} /> : <Copy size={16} />}
            {copied ? "Copied" : canShare ? "Share bill" : "Copy bill"}
          </button>
        </div>
      </div>

      <div className="relative bg-pitch px-5 py-5 text-cream">
        <div
          className={`absolute right-5 top-5 rotate-[-4deg] rounded-ctl border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
            allPaid ? "border-pitch-bright/60 text-pitch-bright" : "border-terracotta/70 text-terracotta-soft"
          }`}
        >
          {allPaid ? "Paid" : "Due"}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-75">{db.settings.cafeName} Bill</p>
            <h2 className="mt-1 font-display text-3xl leading-none">Table {group.tableLabel}</h2>
            <p className="mt-1 text-sm text-cream/80">{group.floor}</p>
            <p className="mt-2 text-sm opacity-85">
              {group.orders.map((order) => order.code).join(", ")} · {clockTime(firstPlacedAt)} · {itemCount} item{itemCount === 1 ? "" : "s"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-widest opacity-75">Total</p>
            <p className="price mt-1 font-display text-3xl leading-none">{npr(total)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          {group.orders.map((order) => (
            <StatusBadge key={order.id} status={order.status} label={`${order.code} · ${STATUS_LABEL[order.status]}`} />
          ))}
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${allPaid ? "bg-pitch-soft text-pitch" : "bg-terracotta-soft text-terracotta"}`}>
            {allPaid ? "Paid" : "Payment due"}
          </span>
          {allPaid && (
            <span className="rounded-full bg-cream px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-ink-soft">
              {paymentLabel(paymentMethod)} · {clockTime(latestUpdatedAt)}
            </span>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-ctl border border-line">
          <div className={`grid gap-3 bg-cream px-3 py-2 text-xs font-bold uppercase tracking-wide text-ink-faint ${allPaid ? "grid-cols-[1fr_3.75rem_4.5rem]" : "grid-cols-[1fr_3.75rem_4.5rem_2.5rem]"}`}>
            <span>Item</span>
            <span className="text-right">Rate</span>
            <span className="text-right">Amount</span>
            {!allPaid && <span className="sr-only">Remove</span>}
          </div>
          <ul className="divide-y divide-line-soft">
            {group.orders.flatMap((order) => order.lines.map((line, index) => ({ order, line, index }))).map(({ order, line, index }) => (
              <li key={`${order.id}-${line.itemId}-${line.batch}-${index}`} className={`grid gap-3 px-3 py-3 text-sm ${allPaid ? "grid-cols-[1fr_3.75rem_4.5rem]" : "grid-cols-[1fr_3.75rem_4.5rem_2.5rem]"}`}>
                <div className="min-w-0">
                  <p className="font-bold leading-snug">
                    <span className="tabular">{line.qty}x</span> {line.name}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-ink-faint">
                    {order.code}
                    {line.batch > 1 && <span className="text-pitch-bright"> · Round {line.batch}</span>}
                  </p>
                  {line.note && <p className="mt-0.5 text-xs text-saffron-deep">Note: {line.note}</p>}
                </div>
                <p className="price text-right text-ink-soft">{npr(line.price)}</p>
                <p className="price text-right font-bold">{npr(line.price * line.qty)}</p>
                {!allPaid && (
                  <button
                    type="button"
                    aria-label={`Remove ${line.name} from bill`}
                    onClick={() => setPendingRemove(`${order.id}-${index}`)}
                    className="receipt-no-print flex h-9 w-9 items-center justify-center self-center rounded-ctl text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {!allPaid && pendingRemove === `${order.id}-${index}` && (
                  <div className="receipt-no-print col-span-full flex flex-wrap items-center justify-end gap-2 rounded-ctl bg-terracotta-soft px-3 py-2">
                    <span className="mr-auto text-xs font-bold text-terracotta">Remove {line.qty}x {line.name}?</span>
                    <button type="button" onClick={() => setPendingRemove(null)} className="rounded-[7px] px-3 py-1.5 text-xs font-bold text-ink-soft">Keep</button>
                    <button type="button" onClick={() => { store.removeOrderLine(order.id, index); setPendingRemove(null); }} className="rounded-[7px] bg-terracotta px-3 py-1.5 text-xs font-bold text-cream">Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {!allPaid && (
          <div className="receipt-no-print mt-4 rounded-ctl border border-line bg-cream p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-bold"><BadgePercent size={17} className="text-pitch" /> Bill discount</p>
              {counterDiscount > 0 && (
                <button type="button" onClick={clearGroupDiscount} className="text-xs font-bold text-terracotta hover:underline">Remove discount</button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="flex rounded-ctl border border-line bg-surface p-1">
                {(["percent", "flat"] as const).map((mode) => (
                  <button key={mode} type="button" onClick={() => setDiscountMode(mode)} aria-pressed={discountMode === mode} className={`rounded-[7px] px-3 py-1.5 text-xs font-bold ${discountMode === mode ? "bg-pitch-soft text-pitch" : "text-ink-faint"}`}>
                    {mode === "percent" ? "%" : "NPR"}
                  </button>
                ))}
              </div>
              <label className="relative min-w-32 flex-1 sm:max-w-48">
                <span className="sr-only">Discount value</span>
                <input
                  type="number"
                  min="0"
                  max={discountMode === "percent" ? 100 : undefined}
                  step="1"
                  inputMode="numeric"
                  value={discountValue}
                  onChange={(event) => setDiscountValue(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyGroupDiscount(); } }}
                  placeholder={discountMode === "percent" ? "e.g. 10" : "e.g. 100"}
                  className="h-10 w-full rounded-ctl border border-line bg-surface px-3 pr-10 text-sm font-bold outline-none placeholder:text-ink-faint focus:border-pitch-bright"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-ink-faint">{discountMode === "percent" ? "%" : "रू"}</span>
              </label>
              <button type="button" onClick={applyGroupDiscount} disabled={discountValue === "" || Number(discountValue) < 0} className="pressable h-10 rounded-ctl bg-pitch px-4 text-sm font-bold text-cream disabled:opacity-40">Apply</button>
            </div>
            {counterDiscount > 0 && <p className="mt-2 text-xs font-bold text-pitch">Current bill discount: −{npr(counterDiscount)}</p>}
          </div>
        )}

        <dl className="price ml-auto mt-4 max-w-xs space-y-2 text-sm">
          {(promoDiscount > 0 || counterDiscount > 0) && (
            <div className="flex justify-between gap-5 text-ink-soft">
              <dt>Items subtotal</dt>
              <dd>{npr(itemsSubtotal)}</dd>
            </div>
          )}
          {promoDiscount > 0 && (
            <div className="flex justify-between gap-5 text-pitch">
              <dt>Promo discount</dt>
              <dd>−{npr(promoDiscount)}</dd>
            </div>
          )}
          {counterDiscount > 0 && (
            <div className="flex justify-between gap-5 text-pitch">
              <dt>Bill discount</dt>
              <dd>−{npr(counterDiscount)}</dd>
            </div>
          )}
          {(vat > 0 || service > 0) && (
            <div className="flex justify-between gap-5 text-ink-soft">
              <dt>Subtotal after discount</dt>
              <dd>{npr(subtotal)}</dd>
            </div>
          )}
          {service > 0 && (
            <div className="flex justify-between gap-5 text-ink-soft">
              <dt>Service charge ({db.settings.serviceChargePercent}%)</dt>
              <dd>{npr(service)}</dd>
            </div>
          )}
          {vat > 0 && (
            <div className="flex justify-between gap-5 text-ink-soft">
              <dt>VAT ({db.settings.vatPercent}%)</dt>
              <dd>{npr(vat)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-5 border-t border-line pt-2 text-lg font-bold text-ink">
            <dt>{allPaid ? "Total paid" : "Total due"}</dt>
            <dd className="font-display">{npr(total)}</dd>
          </div>
        </dl>

        {!allPaid && db.settings.paymentQr.enabled && (
          <PaymentQr
            key={total}
            staticData={db.settings.paymentQr.staticData}
            amount={total}
            remark={db.settings.cafeName}
            billNumber={group.orders.map((o) => o.code).join(",")}
          />
        )}

        {!allPaid ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => markGroupPaid("cash")}
              className="pressable tap-bloom flex items-center justify-center gap-2 rounded-ctl bg-pitch px-4 py-3 text-sm font-bold text-cream hover:bg-pitch-deep"
            >
              <Banknote size={17} /> Paid by cash
            </button>
            <button
              type="button"
              onClick={() => markGroupPaid("counter-qr")}
              className="pressable flex items-center justify-center gap-2 rounded-ctl border border-pitch/30 px-4 py-3 text-sm font-bold text-pitch hover:bg-pitch-soft"
            >
              <QrCode size={17} /> Paid by QR
            </button>
          </div>
        ) : (
          <p className="mt-5 flex items-center justify-center gap-2 rounded-ctl bg-pitch-soft px-4 py-3 text-sm font-bold text-pitch">
            <CheckCircle2 size={17} />
            Payment collected
          </p>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-faint">
          <CreditCard size={13} />
          Cash and counter QR payments are recorded here for reports.
        </p>

        <div className="mt-5 border-t border-line pt-4 text-center">
          <p className="font-display text-lg text-pitch">{db.settings.cafeName}</p>
          <p className="text-xs text-ink-faint">{db.settings.tagline}</p>
          <p className="mt-2 text-xs text-ink-soft">Thank you. Please visit again.</p>
        </div>
      </div>
    </div>
  );
}
