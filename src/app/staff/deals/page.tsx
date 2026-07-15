"use client";

import { useState } from "react";
import { BadgePercent, Boxes, Check, Pencil, Plus } from "lucide-react";
import { Sheet } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { npr } from "@/lib/format";
import { promoDiscount, promoExpired } from "@/lib/orders";
import type { Combo, MenuItem, Promo } from "@/lib/types";

export default function DealsPage() {
  const db = useDB();
  const [editCombo, setEditCombo] = useState<Partial<Combo> | null>(null);
  const [editPromo, setEditPromo] = useState<Partial<Promo> | null>(null);

  const itemName = (id: string) => db.items.find((i) => i.id === id)?.name ?? "—";
  const comboSum = (c: { itemIds: string[] }) =>
    c.itemIds.reduce((n, id) => n + (db.items.find((i) => i.id === id)?.price ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <h1 className="font-display text-2xl text-pitch">Deals</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Combo bundles and promo codes customers can use at checkout.
      </p>

      {/* Combos */}
      <section className="mt-6" aria-label="Combos">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <Boxes size={18} /> Combo bundles
          </h2>
          <button
            type="button"
            onClick={() => setEditCombo({ itemIds: [] })}
            className="pressable flex items-center gap-1 rounded-ctl bg-pitch px-3 py-2 text-xs font-bold text-cream"
          >
            <Plus size={14} /> New combo
          </button>
        </div>

        <ul className="mt-3 divide-y divide-line-soft rounded-card border border-line bg-surface">
          {db.combos.length === 0 && (
            <li className="px-4 py-5 text-center text-sm text-ink-faint">No combos yet.</li>
          )}
          {db.combos.map((combo) => {
            const sum = comboSum(combo);
            const save = Math.max(0, sum - combo.price);
            return (
              <li key={combo.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-bold">
                    {combo.name}
                    {!combo.active && (
                      <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-bold text-ink-soft">Off</span>
                    )}
                  </p>
                  <p className="truncate text-sm text-ink-soft">
                    {combo.itemIds.map(itemName).join(" + ")}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="price font-display text-base text-pitch">{npr(combo.price)}</p>
                  {save > 0 && <p className="price text-xs text-ink-faint">save {npr(save)}</p>}
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${combo.name}`}
                  onClick={() => setEditCombo(combo)}
                  className="pressable flex h-9 w-9 items-center justify-center rounded-ctl text-ink-faint hover:bg-cream hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Promo codes */}
      <section className="mt-8" aria-label="Promo codes">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <BadgePercent size={18} /> Promo codes
          </h2>
          <button
            type="button"
            onClick={() => setEditPromo({ kind: "percent", value: 10 })}
            className="pressable flex items-center gap-1 rounded-ctl bg-pitch px-3 py-2 text-xs font-bold text-cream"
          >
            <Plus size={14} /> New code
          </button>
        </div>

        <ul className="mt-3 divide-y divide-line-soft rounded-card border border-line bg-surface">
          {db.promos.length === 0 && (
            <li className="px-4 py-5 text-center text-sm text-ink-faint">No promo codes yet.</li>
          )}
          {db.promos.map((promo) => {
            const expired = promoExpired(promo);
            return (
              <li key={promo.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-bold tracking-wide">
                    {promo.code}
                    {(!promo.active || expired) && (
                      <span className="rounded-full bg-ink/8 px-2 py-0.5 text-xs font-bold text-ink-soft">
                        {expired ? "Expired" : "Off"}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {promo.kind === "percent" ? `${promo.value}% off` : `${npr(promo.value)} off`}
                    {promo.minSubtotal > 0 && ` · min ${npr(promo.minSubtotal)}`}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Edit ${promo.code}`}
                  onClick={() => setEditPromo(promo)}
                  className="pressable flex h-9 w-9 items-center justify-center rounded-ctl text-ink-faint hover:bg-cream hover:text-ink"
                >
                  <Pencil size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <ComboEditor combo={editCombo} items={db.items} onClose={() => setEditCombo(null)} />
      <PromoEditor promo={editPromo} onClose={() => setEditPromo(null)} />
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-ctl border border-line bg-cream px-3.5 py-2.5 text-base outline-none focus:border-pitch-bright";
const labelCls = "block text-sm font-bold";

function ComboEditor({
  combo,
  items,
  onClose,
}: {
  combo: Partial<Combo> | null;
  items: MenuItem[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<Combo>>({});
  const [prev, setPrev] = useState<Partial<Combo> | null>(null);
  if (combo !== prev) {
    setPrev(combo);
    if (combo) setForm({ active: true, popular: false, itemIds: [], ...combo });
  }
  if (!combo) return null;

  const set = <K extends keyof Combo>(k: K, v: Combo[K]) => setForm((f) => ({ ...f, [k]: v }));
  const itemIds = form.itemIds ?? [];
  const toggleItem = (id: string) =>
    set("itemIds", itemIds.includes(id) ? itemIds.filter((x) => x !== id) : [...itemIds, id]);

  const sum = itemIds.reduce((n, id) => n + (items.find((i) => i.id === id)?.price ?? 0), 0);
  const canSave = (form.name ?? "").trim() && (form.price ?? 0) > 0 && itemIds.length >= 2;

  return (
    <Sheet open onClose={onClose} title={form.id ? "Edit combo" : "New combo"}>
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Name (English)
            <input className={inputCls} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className={labelCls}>
            Name (नेपाली)
            <input className={inputCls} value={form.nameNe ?? ""} onChange={(e) => set("nameNe", e.target.value)} />
          </label>
        </div>

        <div>
          <p className={labelCls}>Items in this combo</p>
          <p className="text-xs text-ink-faint">Pick at least two. Component total: {npr(sum)}</p>
          <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-ctl border border-line bg-cream p-1.5">
            {items.map((i) => {
              const on = itemIds.includes(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => toggleItem(i.id)}
                  className={`flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm ${
                    on ? "bg-pitch text-cream" : "hover:bg-surface"
                  }`}
                >
                  <span className="truncate">{i.name}</span>
                  <span className="price ml-2 shrink-0">
                    {on ? <Check size={15} /> : npr(i.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Bundle price (रू)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              value={form.price ?? ""}
              onChange={(e) => set("price", Number(e.target.value))}
            />
            {sum > 0 && (form.price ?? 0) > 0 && (
              <span className="mt-1 block text-xs font-bold text-pitch">
                Saves {npr(Math.max(0, sum - (form.price ?? 0)))}
              </span>
            )}
          </label>
          <div className="flex flex-col justify-center gap-2 pt-5">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => set("active", e.target.checked)}
                className="h-5 w-5 accent-(--color-pitch)"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={form.popular ?? false}
                onChange={(e) => set("popular", e.target.checked)}
                className="h-5 w-5 accent-(--color-pitch)"
              />
              Featured
            </label>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              getStore().upsertCombo(form as Partial<Combo> & { name: string; price: number; itemIds: string[] });
              onClose();
            }}
            className="pressable flex-1 rounded-ctl bg-pitch py-3.5 font-bold text-cream disabled:opacity-40"
          >
            Save combo
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${form.name}"?`)) {
                  getStore().deleteCombo(form.id!);
                  onClose();
                }
              }}
              className="pressable rounded-ctl border border-terracotta/40 px-4 py-3.5 text-sm font-bold text-terracotta"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function PromoEditor({ promo, onClose }: { promo: Partial<Promo> | null; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Promo>>({});
  const [prev, setPrev] = useState<Partial<Promo> | null>(null);
  if (promo !== prev) {
    setPrev(promo);
    if (promo) setForm({ kind: "percent", value: 10, minSubtotal: 0, active: true, expiresAt: null, ...promo });
  }
  if (!promo) return null;

  const set = <K extends keyof Promo>(k: K, v: Promo[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = (form.code ?? "").trim().length >= 3 && (form.value ?? 0) > 0;

  // Live preview against a sample subtotal.
  const sample = 500;
  const preview =
    canSave && form.kind && form.value != null
      ? promoDiscount(
          {
            id: "preview",
            code: form.code ?? "",
            kind: form.kind,
            value: form.value,
            minSubtotal: form.minSubtotal ?? 0,
            active: true,
            expiresAt: null,
          },
          sample,
        )
      : null;

  const expiryValue = form.expiresAt ? new Date(form.expiresAt).toISOString().slice(0, 10) : "";

  return (
    <Sheet open onClose={onClose} title={form.id ? "Edit code" : "New promo code"}>
      <div className="space-y-4 pb-2">
        <label className={labelCls}>
          Code
          <input
            className={`${inputCls} uppercase tracking-wide`}
            value={form.code ?? ""}
            onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
            placeholder="STRIKE10"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Type
            <select
              className={inputCls}
              value={form.kind ?? "percent"}
              onChange={(e) => set("kind", e.target.value as Promo["kind"])}
            >
              <option value="percent">Percent off</option>
              <option value="flat">Flat रू off</option>
            </select>
          </label>
          <label className={labelCls}>
            {form.kind === "flat" ? "Amount (रू)" : "Percent (%)"}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={form.kind === "flat" ? undefined : 100}
              className={inputCls}
              value={form.value ?? ""}
              onChange={(e) => set("value", Number(e.target.value))}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Minimum order (रू)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              value={form.minSubtotal ?? 0}
              onChange={(e) => set("minSubtotal", Number(e.target.value))}
            />
          </label>
          <label className={labelCls}>
            Expires (optional)
            <input
              type="date"
              className={inputCls}
              value={expiryValue}
              onChange={(e) => set("expiresAt", e.target.value ? new Date(e.target.value).getTime() : null)}
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={form.active ?? true}
            onChange={(e) => set("active", e.target.checked)}
            className="h-5 w-5 accent-(--color-pitch)"
          />
          Active
        </label>

        {preview && (
          <p className="rounded-ctl bg-cream px-3 py-2 text-sm text-ink-soft">
            {preview.ok
              ? `On a ${npr(sample)} order, this takes off ${npr(preview.amount)}.`
              : `On a ${npr(sample)} order this wouldn't apply (below minimum).`}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            disabled={!canSave}
            onClick={() => {
              getStore().upsertPromo(form as Partial<Promo> & { code: string; kind: Promo["kind"]; value: number });
              onClose();
            }}
            className="pressable flex-1 rounded-ctl bg-pitch py-3.5 font-bold text-cream disabled:opacity-40"
          >
            Save code
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete code "${form.code}"?`)) {
                  getStore().deletePromo(form.id!);
                  onClose();
                }
              }}
              className="pressable rounded-ctl border border-terracotta/40 px-4 py-3.5 text-sm font-bold text-terracotta"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
