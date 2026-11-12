"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  ChevronDown,
  Download,
  Plus,
  QrCode,
  ReceiptText,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { getStore } from "@/lib/store";
import { useArchive, useDB } from "@/lib/useStore";
import { clockTime, npr } from "@/lib/format";
import { orderGrandTotal } from "@/lib/orders";
import type { ExpenseCategory, Order, Settings } from "@/lib/types";

type Period = "today" | "week" | "month";
type EntryFilter = "all" | "income" | "expense";

type LedgerEntry = {
  id: string;
  kind: "income" | "expense";
  at: number;
  title: string;
  detail: string;
  method: string;
  amount: number;
  items?: {
    id: string;
    name: string;
    qty: number;
    price: number;
    note: string;
    batch: number;
  }[];
  discount?: { code: string; amount: number } | null;
  expenseId?: string;
};

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "ingredients", label: "Ingredients" },
  { value: "staff", label: "Staff" },
  { value: "utilities", label: "Utilities" },
  { value: "rent", label: "Rent" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
];

const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
};

function periodStart(period: Period): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = date.getDay();
    date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  }
  if (period === "month") date.setDate(1);
  return date.getTime();
}

function localDateInputValue(date = new Date()): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
}

function collectedAmount(order: Order, settings: Settings): number {
  return order.paidAmount ?? orderGrandTotal(order, settings);
}

function entryDateLabel(at: number, period: Period): string {
  if (period === "today") return clockTime(at);
  const date = new Intl.DateTimeFormat("en-NP", { month: "short", day: "numeric" }).format(at);
  return `${date} · ${clockTime(at)}`;
}

export default function ReportsPage() {
  const db = useDB();
  const archive = useArchive();
  const user = useStaff();
  const [period, setPeriod] = useState<Period>("today");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>("ingredients");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [expenseMethod, setExpenseMethod] = useState<"cash" | "bank">("cash");
  const [expenseDate, setExpenseDate] = useState(localDateInputValue);

  const since = periodStart(period);
  const allOrders = period === "today" ? db.orders : [...db.orders, ...archive];
  const paidOrders = allOrders.filter((order) => order.paid && (order.paidAt ?? order.updatedAt) >= since);
  const expenses = db.expenses.filter((expense) => expense.occurredAt >= since);
  const servedUnpaid = allOrders.filter(
    (order) => order.status === "served" && !order.paid && order.placedAt >= since,
  );

  const income = paidOrders.reduce((total, order) => total + collectedAmount(order, db.settings), 0);
  const expenseTotal = expenses.reduce((total, expense) => total + expense.amount, 0);
  const balance = income - expenseTotal;
  const outstanding = servedUnpaid.reduce((total, order) => total + orderGrandTotal(order, db.settings), 0);
  const cashIncome = paidOrders
    .filter((order) => order.paymentMethod === "cash")
    .reduce((total, order) => total + collectedAmount(order, db.settings), 0);
  const qrIncome = paidOrders
    .filter((order) => order.paymentMethod === "counter-qr")
    .reduce((total, order) => total + collectedAmount(order, db.settings), 0);

  const itemSales = new Map<string, { name: string; qty: number; revenue: number }>();
  paidOrders.forEach((order) => {
    order.lines.forEach((line) => {
      const current = itemSales.get(line.itemId) ?? { name: line.name, qty: 0, revenue: 0 };
      current.qty += line.qty;
      current.revenue += line.qty * line.price;
      itemSales.set(line.itemId, current);
    });
  });
  const bestSellers = [...itemSales.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue).slice(0, 5);
  const topQuantity = Math.max(1, ...bestSellers.map((item) => item.qty));

  const entries: LedgerEntry[] = [
    ...paidOrders.map((order) => {
      const table = db.tables.find((item) => item.id === order.tableId)?.label ?? "Unknown table";
      const collector = db.staff.find((staff) => staff.id === order.paidBy)?.name;
      return {
        id: `order-${order.id}`,
        kind: "income" as const,
        at: order.paidAt ?? order.updatedAt,
        title: `Order ${order.code}`,
        detail: `${table} · ${order.lines.reduce((sum, line) => sum + line.qty, 0)} items${collector ? ` · ${collector}` : ""}`,
        method: order.paymentMethod === "counter-qr" ? "Counter QR" : "Cash",
        amount: collectedAmount(order, db.settings),
        items: order.lines.map((line, index) => ({
          id: `${order.id}-${line.itemId}-${line.batch}-${index}`,
          name: line.name,
          qty: line.qty,
          price: line.price,
          note: line.note,
          batch: line.batch,
        })),
        discount: order.discount,
      };
    }),
    ...expenses.map((expense) => ({
      id: `expense-${expense.id}`,
      kind: "expense" as const,
      at: expense.occurredAt,
      title: expense.note || EXPENSE_CATEGORIES.find((item) => item.value === expense.category)?.label || "Expense",
      detail: `${EXPENSE_CATEGORIES.find((item) => item.value === expense.category)?.label ?? "Other"} · ${expense.recordedBy}`,
      method: expense.paymentMethod === "bank" ? "Bank / QR" : "Cash",
      amount: expense.amount,
      expenseId: expense.id,
    })),
  ].sort((a, b) => b.at - a.at);

  const visibleEntries = entries.filter((entry) => entryFilter === "all" || entry.kind === entryFilter);

  const addExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || !note.trim()) return;
    const selected = new Date(`${expenseDate}T12:00:00`);
    getStore().addExpense({
      category,
      amount: value,
      note,
      paymentMethod: expenseMethod,
      occurredAt: selected.getTime(),
      recordedBy: user.name,
    });
    setAmount("");
    setNote("");
    setExpenseDate(localDateInputValue());
    setShowExpenseForm(false);
  };

  const exportLedger = () => {
    const rows = [
      ["date", "type", "description", "detail", "payment_method", "amount_npr"],
      ...entries.map((entry) => [
        new Date(entry.at).toISOString(),
        entry.kind,
        entry.title,
        entry.detail,
        entry.method,
        String(entry.kind === "expense" ? -entry.amount : entry.amount),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `strike-yard-ledger-${period}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 lg:py-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-pitch">
            <WalletCards size={20} />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Owner view</p>
          </div>
          <h1 className="mt-1 font-display text-3xl text-pitch">Cafe ledger</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-soft">
            Payments become income automatically. Add operating costs here to see the cafe&apos;s real balance.
          </p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={exportLedger}
            disabled={entries.length === 0}
            className="pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-ctl border border-line bg-surface px-3.5 text-sm font-bold text-ink-soft disabled:opacity-40 sm:flex-none"
          >
            <Download size={16} /> Export
          </button>
          <button
            type="button"
            onClick={() => setShowExpenseForm((current) => !current)}
            aria-expanded={showExpenseForm}
            className="pressable flex h-11 flex-1 items-center justify-center gap-2 rounded-ctl bg-pitch px-4 text-sm font-bold text-cream hover:bg-pitch-deep sm:flex-none"
          >
            {showExpenseForm ? <X size={17} /> : <Plus size={17} />}
            {showExpenseForm ? "Close" : "Add expense"}
          </button>
        </div>
      </header>

      <div className="rail mt-5 flex overflow-x-auto rounded-ctl border border-line bg-surface p-1 sm:w-fit" aria-label="Ledger period">
        {(["today", "week", "month"] as Period[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            aria-pressed={period === value}
            className={`pressable min-w-fit rounded-[7px] px-4 py-2 text-sm font-bold ${
              period === value ? "bg-pitch text-cream" : "text-ink-soft hover:bg-cream"
            }`}
          >
            {PERIOD_LABEL[value]}
          </button>
        ))}
      </div>

      {showExpenseForm && (
        <form onSubmit={addExpense} className="animate-fade-in mt-4 rounded-card border border-pitch/20 bg-surface p-4 shadow-lift">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Record an expense</h2>
              <p className="text-sm text-ink-soft">Purchases, wages, rent, utilities, or repairs.</p>
            </div>
            <span className="hidden rounded-full bg-pitch-soft px-3 py-1 text-xs font-bold text-pitch sm:inline">Syncs to all devices</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.25fr_0.7fr_0.75fr]">
            <label className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Category
              <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)} className="mt-1.5 h-11 w-full rounded-ctl border border-line bg-cream px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-pitch-bright">
                {EXPENSE_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Description
              <input value={note} onChange={(event) => setNote(event.target.value)} required placeholder="e.g. Morning milk delivery" className="mt-1.5 h-11 w-full rounded-ctl border border-line bg-cream px-3 text-sm font-normal normal-case tracking-normal text-ink outline-none placeholder:text-ink-faint focus:border-pitch-bright" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Amount (NPR)
              <input value={amount} onChange={(event) => setAmount(event.target.value)} required min="1" step="1" inputMode="numeric" type="number" placeholder="0" className="price mt-1.5 h-11 w-full rounded-ctl border border-line bg-cream px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none placeholder:text-ink-faint focus:border-pitch-bright" />
            </label>
            <label className="text-xs font-bold uppercase tracking-wide text-ink-faint">
              Date
              <input value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} max={localDateInputValue()} required type="date" className="mt-1.5 h-11 w-full rounded-ctl border border-line bg-cream px-3 text-sm font-bold normal-case tracking-normal text-ink outline-none focus:border-pitch-bright" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-ctl border border-line bg-cream p-1" aria-label="Expense payment method">
              {(["cash", "bank"] as const).map((method) => (
                <button key={method} type="button" onClick={() => setExpenseMethod(method)} aria-pressed={expenseMethod === method} className={`rounded-[7px] px-3 py-1.5 text-sm font-bold ${expenseMethod === method ? "bg-surface text-pitch shadow-sm" : "text-ink-faint"}`}>
                  {method === "cash" ? "Cash" : "Bank / QR"}
                </button>
              ))}
            </div>
            <button type="submit" disabled={!note.trim() || Number(amount) <= 0} className="pressable h-11 rounded-ctl bg-pitch px-5 text-sm font-bold text-cream disabled:opacity-40">
              Save expense
            </button>
          </div>
        </form>
      )}

      <section className="mt-5 overflow-hidden rounded-card border border-line bg-pitch text-cream shadow-lift" aria-label="Financial summary">
        <div className="grid md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="p-5 md:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-pitch-soft">Net balance · {PERIOD_LABEL[period]}</p>
            <p className={`price mt-2 font-display text-4xl ${balance < 0 ? "text-terracotta-soft" : "text-cream"}`}>{npr(balance)}</p>
            <p className="mt-2 text-sm text-pitch-soft">Collected revenue minus recorded expenses.</p>
          </div>
          <div className="grid grid-cols-2 border-t border-pitch-bright/20 md:border-l md:border-t-0">
            <SummaryCell label="Revenue" value={income} icon="up" />
            <SummaryCell label="Expenses" value={expenseTotal} icon="down" />
          </div>
          <div className="grid grid-cols-2 border-t border-pitch-bright/20 md:border-l md:border-t-0">
            <SummaryCell label="Paid orders" value={paidOrders.length} count icon="orders" />
            <SummaryCell label="Still to collect" value={outstanding} icon="due" danger={outstanding > 0} />
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.75fr)]">
        <section className="min-w-0" aria-label="Ledger entries">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Transactions</h2>
              <p className="text-sm text-ink-soft">{entries.length} entries in {PERIOD_LABEL[period].toLowerCase()}</p>
            </div>
            <div className="flex rounded-ctl border border-line bg-surface p-1">
              {(["all", "income", "expense"] as EntryFilter[]).map((value) => (
                <button key={value} type="button" onClick={() => setEntryFilter(value)} aria-pressed={entryFilter === value} className={`rounded-[7px] px-3 py-1.5 text-xs font-bold capitalize ${entryFilter === value ? "bg-pitch-soft text-pitch" : "text-ink-faint"}`}>
                  {value === "all" ? "All" : value === "income" ? "Income" : "Expenses"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
            {visibleEntries.length > 0 ? (
              <ul className="divide-y divide-line-soft">
                {visibleEntries.map((entry) => {
                  const expanded = expandedEntryId === entry.id;
                  return (
                    <li key={entry.id} className="group">
                      {entry.kind === "income" ? (
                        <button
                          type="button"
                          onClick={() => setExpandedEntryId(expanded ? null : entry.id)}
                          aria-expanded={expanded}
                          aria-controls={`${entry.id}-details`}
                          className="pressable flex w-full items-center gap-3 px-3.5 py-3.5 text-left hover:bg-cream/60 sm:px-4"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pitch-soft text-pitch">
                            <ArrowUpRight size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="truncate font-bold">{entry.title}</p>
                              <span className="shrink-0 text-xs text-ink-faint">{entryDateLabel(entry.at, period)}</span>
                            </div>
                            <p className="truncate text-xs text-ink-soft">{entry.detail} · {entry.method}</p>
                          </div>
                          <p className="price shrink-0 font-display text-lg text-pitch">+{npr(entry.amount)}</p>
                          <ChevronDown size={18} className={`shrink-0 text-ink-faint transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 px-3.5 py-3.5 sm:px-4">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta-soft text-terracotta">
                            <ArrowDownLeft size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="truncate font-bold">{entry.title}</p>
                              <span className="shrink-0 text-xs text-ink-faint">{entryDateLabel(entry.at, period)}</span>
                            </div>
                            <p className="truncate text-xs text-ink-soft">{entry.detail} · {entry.method}</p>
                          </div>
                          <p className="price shrink-0 font-display text-lg text-terracotta">−{npr(entry.amount)}</p>
                          {entry.expenseId && (
                            <button type="button" aria-label={`Delete ${entry.title}`} onClick={() => { if (window.confirm(`Delete expense “${entry.title}”?`)) getStore().deleteExpense(entry.expenseId!); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl text-ink-faint hover:bg-terracotta-soft hover:text-terracotta sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}

                      {entry.kind === "income" && expanded && (
                        <div id={`${entry.id}-details`} className="animate-fade-in border-t border-line-soft bg-cream/55 px-4 py-3.5 sm:pl-[4.75rem] sm:pr-5">
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Items ordered</p>
                          <ul className="mt-2 divide-y divide-line-soft">
                            {entry.items?.map((item) => (
                              <li key={item.id} className="flex items-start justify-between gap-4 py-2.5 first:pt-1">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold"><span className="tabular text-pitch">{item.qty}×</span> {item.name}</p>
                                  {(item.note || item.batch > 1) && (
                                    <p className="mt-0.5 text-xs text-ink-soft">
                                      {item.batch > 1 && `Round ${item.batch}`}
                                      {item.batch > 1 && item.note && " · "}
                                      {item.note && `Note: ${item.note}`}
                                    </p>
                                  )}
                                </div>
                                <p className="price shrink-0 text-sm font-bold text-ink-soft">{npr(item.qty * item.price)}</p>
                              </li>
                            ))}
                          </ul>
                          {entry.discount && (
                            <div className="flex items-center justify-between gap-4 border-t border-line-soft py-2 text-sm text-pitch">
                              <span className="font-bold">Promo {entry.discount.code}</span>
                              <span className="price">−{npr(entry.discount.amount)}</span>
                            </div>
                          )}
                          <div className="flex items-center justify-between gap-4 border-t border-line pt-2.5">
                            <span className="text-sm font-bold text-ink-soft">Amount collected</span>
                            <span className="price font-display text-lg text-pitch">{npr(entry.amount)}</span>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="px-5 py-12 text-center">
                <ReceiptText size={28} className="mx-auto text-ink-faint" />
                <p className="mt-3 font-bold">No {entryFilter === "all" ? "transactions" : entryFilter} yet</p>
                <p className="mt-1 text-sm text-ink-faint">Paid orders and recorded costs will appear here.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-5">
          <section aria-label="Payment split">
            <div className="flex items-center gap-2">
              <Banknote size={18} className="text-pitch" />
              <h2 className="font-display text-xl">Money collected</h2>
            </div>
            <div className="mt-3 divide-y divide-line-soft overflow-hidden rounded-card border border-line bg-surface">
              <SplitRow icon={<Banknote size={16} />} label="Cash" value={cashIncome} total={income} />
              <SplitRow icon={<QrCode size={16} />} label="Counter QR" value={qrIncome} total={income} />
            </div>
          </section>

          <section aria-label="Best sellers">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-pitch" />
              <h2 className="font-display text-xl">Best sellers</h2>
            </div>
            <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
              {bestSellers.length > 0 ? (
                <ol className="divide-y divide-line-soft">
                  {bestSellers.map((item, index) => (
                    <li key={item.name} className="px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 truncate text-sm font-bold"><span className="mr-2 text-ink-faint">{index + 1}</span>{item.name}</p>
                        <p className="shrink-0 text-xs font-bold text-ink-soft">{item.qty} sold</p>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream">
                        <div className="h-full rounded-full bg-pitch-bright" style={{ width: `${Math.max(8, (item.qty / topQuantity) * 100)}%` }} />
                      </div>
                      <p className="mt-1 text-right text-xs text-ink-faint">{npr(item.revenue)} item sales</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-4 py-8 text-center text-sm text-ink-faint">Best sellers appear after payments are collected.</p>
              )}
            </div>
          </section>

          <p className="flex items-start gap-2 rounded-ctl bg-pitch-soft px-3.5 py-3 text-xs leading-relaxed text-pitch">
            <CalendarDays size={15} className="mt-0.5 shrink-0" />
            Revenue is locked when the counter marks an order paid. Expenses are synced through the same shared database as orders.
          </p>
        </aside>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, count, icon, danger }: { label: string; value: number; count?: boolean; icon: "up" | "down" | "orders" | "due"; danger?: boolean }) {
  const Icon = icon === "up" ? ArrowUpRight : icon === "down" ? ArrowDownLeft : icon === "orders" ? ReceiptText : WalletCards;
  return (
    <div className="min-w-0 p-4 md:flex md:flex-col md:justify-center">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-pitch-soft"><Icon size={14} /> {label}</p>
      <p className={`price mt-1 font-display text-xl ${danger ? "text-saffron" : "text-cream"}`}>{count ? value : npr(value)}</p>
    </div>
  );
}

function SplitRow({ icon, label, value, total }: { icon: React.ReactNode; label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="flex items-center gap-2 font-bold text-ink-soft">{icon}{label}</p>
        <p className="price font-bold">{npr(value)}</p>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream"><div className="h-full rounded-full bg-pitch-bright" style={{ width: `${percent}%` }} /></div>
        <span className="tabular w-9 text-right text-xs text-ink-faint">{percent}%</span>
      </div>
    </div>
  );
}
