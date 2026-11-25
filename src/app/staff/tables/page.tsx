"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import QRCode from "qrcode";
import { ArrowUpRight, Download, Plus, Printer, Trash2 } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { StatusBadge } from "@/components/ui";
import { getStore } from "@/lib/store";
import { BASE_PATH } from "@/lib/assets";
import { npr } from "@/lib/format";
import { billCharges, orderTotal } from "@/lib/orders";
import { floorLabel, isUnpaidServed, TABLE_FLOORS, tableMenuPath } from "@/lib/tables";
import { useDB } from "@/lib/useStore";
import type { CafeTable, TableFloor } from "@/lib/types";
import { isOpen } from "@/lib/types";

export default function TablesPage() {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">Loading tables...</p>}>
      <TableDashboardRoute />
    </Suspense>
  );
}

function TableDashboardRoute() {
  const tableId = useSearchParams().get("table");
  return <TableDashboard key={tableId} initialTableId={tableId} />;
}

function TableDashboard({ initialTableId }: { initialTableId: string | null }) {
  const db = useDB();
  const { role } = useStaff();
  const [floorOverride, setFloor] = useState<TableFloor | null>(null);
  const [selectedId, setSelectedId] = useState(initialTableId);
  const selected = db.tables.find((table) => table.id === selectedId);
  const floor = floorOverride ?? selected?.floor ?? "ground";
  const tables = db.tables.filter((table) => (table.floor ?? "ground") === floor && table.active);
  const service = db.orders.filter(isOpen);
  const unpaid = db.orders.filter(isUnpaidServed);
  const calls = db.calls.filter((call) => !call.resolvedAt);
  const current = selected && tables.includes(selected) ? selected : null;
  const currentService = service.filter((order) => order.tableId === current?.id);
  const currentUnpaid = unpaid.filter((order) => order.tableId === current?.id);
  const due = billCharges(currentUnpaid.reduce((sum, order) => sum + orderTotal(order), 0), db.settings).total;
  const canBill = role === "admin" || role === "counter";
  const canManage = role === "admin";

  if (role === "kitchen") return <p className="p-6">The table dashboard is for floor and counter staff.</p>;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8">
      <div className="print:hidden">
        <h1 className="font-display text-2xl text-pitch">Live tables</h1>
        <p className="mt-1 text-sm text-ink-soft">Pick a table to see what is still in service and what is ready to bill.</p>
        <div aria-label="Floor" role="group" className="mt-5 flex w-fit gap-1 rounded-ctl border border-line bg-surface p-1">
          {TABLE_FLOORS.map((item) => (
            <button key={item.id} type="button" aria-pressed={floor === item.id}
              onClick={() => { if (floor !== item.id) { setFloor(item.id); setSelectedId(null); } }}
              className={`min-h-11 rounded-ctl px-4 text-sm font-bold ${floor === item.id ? "bg-pitch text-cream" : "text-ink-soft hover:bg-cream"}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <section aria-label={floorLabel(floor)} className="overflow-hidden rounded-card border border-line bg-surface">
            <p className="border-b border-line px-4 py-3 text-sm font-bold text-ink-soft">{tables.length} {tables.length === 1 ? "table" : "tables"}</p>
            {tables.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft">{canManage ? "Add or move a table here in Manage tables & QR codes." : "No tables are assigned to this floor yet."}</p>
            ) : (
              <ul className="divide-y divide-line">
                {tables.map((table) => {
                  const open = service.filter((order) => order.tableId === table.id);
                  const ready = open.filter((order) => order.status === "ready").length;
                  const hasBill = unpaid.some((order) => order.tableId === table.id);
                  const hasCall = calls.some((call) => call.tableId === table.id);
                  return (
                    <li key={table.id}>
                      <button type="button" aria-pressed={current?.id === table.id}
                        onClick={() => setSelectedId(table.id)}
                        className={`flex min-h-14 w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left ${current?.id === table.id ? "bg-pitch-soft" : "hover:bg-cream"}`}>
                        <span className="font-bold text-pitch">{table.label}</span>
                        <span className="flex flex-wrap gap-1.5 text-xs font-bold">
                          {hasCall && <span className="rounded-full bg-saffron-soft px-2 py-1 text-saffron-deep">Waiter called</span>}
                          {ready > 0 && <span className="rounded-full bg-pitch-soft px-2 py-1 text-pitch">{ready} ready</span>}
                          {open.length > ready && <span className="rounded-full bg-cream px-2 py-1 text-ink-soft">{open.length - ready} in kitchen</span>}
                          {hasBill && <span className="rounded-full bg-terracotta-soft px-2 py-1 text-terracotta">Bill due</span>}
                          {!hasCall && !hasBill && open.length === 0 && <span className="text-ink-soft">No activity</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {current ? (
            <section aria-label={`${current.label} details`} className="rounded-card border border-line bg-surface p-4 shadow-lift sm:p-5">
              <p className="text-sm text-ink-soft">{floorLabel(current.floor)}</p>
              <h2 className="font-display text-xl text-pitch">{current.label}</h2>
              {calls.some((call) => call.tableId === current.id) && (
                <p className="mt-3 rounded-ctl bg-saffron-soft px-3 py-2 text-sm font-bold text-saffron-deep">Waiter call open</p>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
                <div>
                  <p className="text-sm font-bold text-ink-soft">Served, unpaid</p>
                  <p className="font-display text-xl tabular-nums text-pitch">{npr(due)}</p>
                </div>
                {canBill && currentUnpaid.length > 0 && (
                  <Link href={{ pathname: "/staff/billing", query: { table: current.id } }}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-ctl bg-pitch px-4 text-sm font-bold text-cream">
                    Open bill <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">Current orders</h3>
                {(role === "admin" || role === "waiter") && (
                  <Link href={{ pathname: "/staff", query: { table: current.id } }}
                    className="inline-flex min-h-11 items-center gap-1 text-sm font-bold text-pitch underline underline-offset-4">
                    Open orders &amp; calls <ArrowUpRight size={15} />
                  </Link>
                )}
              </div>
              {currentService.length + currentUnpaid.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">No open orders or unpaid bills.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {[...currentService, ...currentUnpaid].map((order) => (
                    <li key={order.id} className="py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{order.code}</span>
                        <StatusBadge status={order.status} label={order.status} />
                      </div>
                      <p className="mt-1 text-sm text-ink-soft">{order.lines.map((line) => `${line.qty}x ${line.name}`).join(", ")}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <p className="rounded-card border border-dashed border-line p-5 text-sm text-ink-soft">Select a table to review its orders and bill.</p>
          )}
        </div>
      </div>
      {canManage && (
        <details className="mt-6 border-t border-line pt-2">
          <summary className="cursor-pointer py-3 font-bold text-pitch print:hidden">Manage tables &amp; QR codes</summary>
          <TableManagement />
        </details>
      )}
    </div>
  );
}

function TableManagement() {
  const db = useDB();
  const [newLabel, setNewLabel] = useState("");
  const [newFloor, setNewFloor] = useState<TableFloor>("ground");
  const [qrs, setQrs] = useState<Record<string, string>>({});

  // Render QR data URLs whenever tables change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const t of db.tables) {
        next[t.id] = await QRCode.toDataURL(`${window.location.origin}${BASE_PATH}${tableMenuPath(t.id)}`, {
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

  return (
    <div className="w-full py-3">
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
        className="mt-4 flex flex-wrap gap-2 print:hidden"
        onSubmit={(e) => {
          e.preventDefault();
          if (newLabel.trim()) {
            getStore().addTable(newLabel.trim(), newFloor);
            setNewLabel("");
          }
        }}
      >
        <input
          aria-label="New table name"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New table name, e.g. T9 or Terrace 2"
          className="min-w-0 flex-1 rounded-ctl border border-line bg-surface px-4 py-3 outline-none placeholder:text-ink-faint focus:border-pitch-bright"
        />
        <FloorSelect value={newFloor} onChange={setNewFloor} />
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
          const busy = db.orders.some((o) => o.tableId === t.id && (isOpen(o) || isUnpaidServed(o)))
            || db.calls.some((call) => call.tableId === t.id && !call.resolvedAt);
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
              <p className="text-sm text-ink-soft">{floorLabel(t.floor)}</p>

              <TableEditor key={`${t.id}-${t.label}-${t.floor}`} table={t} />

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
                    if (busy) {
                      window.alert(`${t.label} has open orders, an unpaid bill, or a waiter call. Clear them before removing this table.`);
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
        QR codes stay valid when you rename or move a table.
      </p>
    </div>
  );
}

function FloorSelect({ value, onChange }: { value: TableFloor; onChange: (floor: TableFloor) => void }) {
  return (
    <select aria-label="Floor" value={value} onChange={(event) => onChange(event.target.value === "upstairs" ? "upstairs" : "ground")}
      className="min-h-11 rounded-ctl border border-line bg-surface px-2 text-sm text-ink">
      {TABLE_FLOORS.map((floor) => <option key={floor.id} value={floor.id}>{floor.label}</option>)}
    </select>
  );
}

function TableEditor({ table }: { table: CafeTable }) {
  const [label, setLabel] = useState(table.label);
  const [floor, setFloor] = useState<TableFloor>(table.floor ?? "ground");
  return (
    <form className="mt-3 flex flex-wrap items-center justify-center gap-2 print:hidden" onSubmit={(event) => {
      event.preventDefault();
      if (label.trim()) getStore().updateTable(table.id, { label: label.trim(), floor });
    }}>
      <input aria-label={`Name for ${table.label}`} value={label} onChange={(event) => setLabel(event.target.value)}
        className="min-h-11 w-full rounded-ctl border border-line px-2 text-sm" />
      <FloorSelect value={floor} onChange={setFloor} />
      <button type="submit" disabled={!label.trim() || (label.trim() === table.label && floor === (table.floor ?? "ground"))}
        className="min-h-11 rounded-ctl bg-pitch px-3 text-sm font-bold text-cream disabled:opacity-40">Save</button>
    </form>
  );
}
