"use client";

import { useState } from "react";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { timeAgo } from "@/lib/format";

export default function InventoryPage() {
  const db = useDB();
  const user = useStaff();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("kg");

  const low = db.inventory.filter((i) => i.qty <= i.lowThreshold);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <h1 className="font-display text-2xl text-pitch">Inventory</h1>

      {low.length > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-card border border-saffron-deep/30 bg-saffron-soft px-4 py-3 text-sm font-bold text-saffron-deep">
          <AlertTriangle size={17} className="shrink-0" />
          Low stock: {low.map((i) => i.name).join(", ")}
        </p>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            getStore().upsertInventory({ name: name.trim(), unit });
            setName("");
          }
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New ingredient, e.g. Cheese"
          className="min-w-0 flex-1 rounded-ctl border border-line bg-surface px-4 py-3 outline-none placeholder:text-ink-faint focus:border-pitch-bright"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          aria-label="Unit"
          className="rounded-ctl border border-line bg-surface px-3 py-3 font-bold"
        >
          {["kg", "L", "pcs", "pkt"].map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-ctl bg-pitch px-4 py-3 text-sm font-bold text-cream disabled:opacity-40"
        >
          Add
        </button>
      </form>

      <ul className="mt-4 divide-y divide-line-soft rounded-card border border-line bg-surface">
        {db.inventory.map((inv) => {
          const isLow = inv.qty <= inv.lowThreshold;
          return (
            <li key={inv.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{inv.name}</p>
                <p className={`tabular text-sm ${isLow ? "font-bold text-saffron-deep" : "text-ink-soft"}`}>
                  {inv.qty} {inv.unit}
                  {isLow && " — low"}
                  <span className="text-ink-faint"> · alert at {inv.lowThreshold}</span>
                </p>
              </div>
              <button
                type="button"
                aria-label={`Remove one ${inv.unit} of ${inv.name}`}
                onClick={() => getStore().adjustInventory(inv.id, -1, "used", user.name)}
                disabled={inv.qty <= 0}
                className="flex h-11 w-11 items-center justify-center rounded-ctl border border-line text-ink-soft disabled:opacity-30"
              >
                <Minus size={17} />
              </button>
              <button
                type="button"
                aria-label={`Add one ${inv.unit} of ${inv.name}`}
                onClick={() => getStore().adjustInventory(inv.id, 1, "restocked", user.name)}
                className="flex h-11 w-11 items-center justify-center rounded-ctl border border-line text-ink-soft"
              >
                <Plus size={17} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${inv.name}`}
                onClick={() => {
                  if (window.confirm(`Delete "${inv.name}" from inventory?`)) getStore().deleteInventory(inv.id);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-ctl text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
              >
                <Trash2 size={17} />
              </button>
            </li>
          );
        })}
        {db.inventory.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-faint">No ingredients tracked yet.</li>
        )}
      </ul>

      {db.inventoryLogs.length > 0 && (
        <section className="mt-6" aria-label="Adjustment log">
          <h2 className="font-display text-lg">Recent adjustments</h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-soft">
            {db.inventoryLogs.slice(0, 15).map((log) => {
              const inv = db.inventory.find((i) => i.id === log.inventoryId);
              return (
                <li key={log.id} className="flex justify-between gap-3">
                  <span>
                    <span className={`tabular font-bold ${log.delta > 0 ? "text-pitch-bright" : "text-terracotta"}`}>
                      {log.delta > 0 ? "+" : ""}
                      {log.delta}
                    </span>{" "}
                    {inv?.name ?? "deleted item"} ({log.reason}, {log.by})
                  </span>
                  <span className="shrink-0 text-ink-faint">{timeAgo(log.at)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
