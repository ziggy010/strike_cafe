"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { DietMark, Sheet, SpiceLevel } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { npr } from "@/lib/format";
import type { Category, Diet, MenuItem, Stock } from "@/lib/types";

export default function MenuManagePage() {
  const db = useDB();
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null);
  const [editingCat, setEditingCat] = useState<Partial<Category> | null>(null);

  const categories = [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-pitch">Menu</h1>
        <button
          type="button"
          onClick={() => setEditingCat({})}
          className="flex items-center gap-1.5 rounded-ctl border border-pitch/30 px-3.5 py-2.5 text-sm font-bold text-pitch"
        >
          <Plus size={16} /> Category
        </button>
      </div>

      {categories.map((cat, ci) => {
        const items = db.items
          .filter((i) => i.categoryId === cat.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return (
          <section key={cat.id} className="mt-6" aria-label={cat.name}>
            <div className="flex items-center gap-1.5">
              <h2 className="flex-1 font-display text-lg">{cat.name}</h2>
              <Reorder
                onUp={ci > 0 ? () => getStore().moveCategory(cat.id, -1) : undefined}
                onDown={ci < categories.length - 1 ? () => getStore().moveCategory(cat.id, 1) : undefined}
              />
              <IconBtn label={`Edit ${cat.name}`} onClick={() => setEditingCat(cat)}>
                <Pencil size={15} />
              </IconBtn>
              <IconBtn
                label={`Delete ${cat.name}`}
                danger
                onClick={() => {
                  if (window.confirm(`Delete "${cat.name}" and all its items?`)) {
                    getStore().deleteCategory(cat.id);
                  }
                }}
              >
                <Trash2 size={15} />
              </IconBtn>
              <button
                type="button"
                onClick={() => setEditing({ categoryId: cat.id })}
                className="ml-1 flex items-center gap-1 rounded-ctl bg-pitch px-3 py-2 text-xs font-bold text-cream"
              >
                <Plus size={14} /> Item
              </button>
            </div>

            <ul className="mt-2 divide-y divide-line-soft rounded-card border border-line bg-surface">
              {items.length === 0 && (
                <li className="px-4 py-5 text-center text-sm text-ink-faint">No items yet — add the first one.</li>
              )}
              {items.map((item, ii) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  {item.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photo} alt="" className="h-10 w-10 shrink-0 rounded-ctl object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ctl bg-cream text-ink-faint">
                      <ImagePlus size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-bold">
                      <DietMark diet={item.diet} />
                      {item.name}
                      <SpiceLevel level={item.spice} />
                      {item.popular && <Star size={13} className="shrink-0 text-saffron-deep" fill="currentColor" />}
                    </p>
                    <p className="price text-sm text-ink-soft">{npr(item.price)}</p>
                  </div>
                  <StockControl value={item.stock} onChange={(s) => getStore().setStock(item.id, s)} />
                  <Reorder
                    onUp={ii > 0 ? () => getStore().moveItem(item.id, -1) : undefined}
                    onDown={ii < items.length - 1 ? () => getStore().moveItem(item.id, 1) : undefined}
                  />
                  <IconBtn label={`Edit ${item.name}`} onClick={() => setEditing(item)}>
                    <Pencil size={15} />
                  </IconBtn>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <ItemEditor item={editing} categories={categories} onClose={() => setEditing(null)} />
      <CategoryEditor cat={editingCat} onClose={() => setEditingCat(null)} />
    </div>
  );
}

function Reorder({ onUp, onDown }: { onUp?: () => void; onDown?: () => void }) {
  return (
    <span className="flex flex-col">
      <button
        type="button"
        aria-label="Move up"
        disabled={!onUp}
        onClick={onUp}
        className="flex h-5 w-8 items-center justify-center text-ink-faint hover:text-ink disabled:opacity-25"
      >
        <ChevronUp size={15} />
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={!onDown}
        onClick={onDown}
        className="flex h-5 w-8 items-center justify-center text-ink-faint hover:text-ink disabled:opacity-25"
      >
        <ChevronDown size={15} />
      </button>
    </span>
  );
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl transition-colors ${
        danger ? "text-ink-faint hover:bg-terracotta-soft hover:text-terracotta" : "text-ink-faint hover:bg-cream hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

const STOCK_OPTS: { value: Stock; label: string; activeCls: string }[] = [
  { value: "in", label: "In", activeCls: "bg-pitch-soft text-pitch" },
  { value: "low", label: "Low", activeCls: "bg-saffron-soft text-saffron-deep" },
  { value: "out", label: "Out", activeCls: "bg-terracotta-soft text-terracotta" },
];

function StockControl({ value, onChange }: { value: Stock; onChange: (s: Stock) => void }) {
  return (
    <span className="flex rounded-ctl border border-line p-0.5 text-xs font-bold" role="radiogroup" aria-label="Stock">
      {STOCK_OPTS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] px-2.5 py-1.5 transition-colors ${value === o.value ? o.activeCls : "text-ink-faint"}`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** Downscale uploads to ≤512px JPEG data URLs so localStorage stays small. */
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 512 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      // WebP data URL: smaller than JPEG, and menu photos ride inside the
      // synced app_state blob, so keeping them small keeps realtime fast.
      resolve(canvas.toDataURL("image/webp", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

function ItemEditor({
  item,
  categories,
  onClose,
}: {
  item: Partial<MenuItem> | null;
  categories: Category[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<MenuItem>>({});
  const [prevItem, setPrevItem] = useState<Partial<MenuItem> | null>(null);
  if (item !== prevItem) {
    setPrevItem(item);
    if (item) setForm({ ...item });
  }
  if (!item) return null;

  const set = <K extends keyof MenuItem>(k: K, v: MenuItem[K]) => setForm((f) => ({ ...f, [k]: v }));
  const canSave = (form.name ?? "").trim() && (form.price ?? 0) > 0 && form.categoryId;

  const save = () => {
    getStore().upsertItem(form as Partial<MenuItem> & { name: string; categoryId: string; price: number });
    onClose();
  };

  const input =
    "mt-1 w-full rounded-ctl border border-line bg-cream px-3.5 py-2.5 text-base outline-none focus:border-pitch-bright";
  const label = "block text-sm font-bold";

  return (
    <Sheet open onClose={onClose} title={form.id ? "Edit item" : "New item"}>
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Name (English)
            <input className={input} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className={label}>
            Name (नेपाली)
            <input className={input} value={form.nameNe ?? ""} onChange={(e) => set("nameNe", e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Description (English)
            <input className={input} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </label>
          <label className={label}>
            Description (नेपाली)
            <input className={input} value={form.descriptionNe ?? ""} onChange={(e) => set("descriptionNe", e.target.value)} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className={label}>
            Price (रू)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={input}
              value={form.price ?? ""}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </label>
          <label className={label}>
            Category
            <select className={input} value={form.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Prep time (min)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={input}
              value={form.prepMin ?? 10}
              onChange={(e) => set("prepMin", Number(e.target.value))}
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Diet
            <select className={input} value={form.diet ?? "none"} onChange={(e) => set("diet", e.target.value as Diet)}>
              <option value="none">Not marked</option>
              <option value="veg">Veg</option>
              <option value="nonveg">Non-veg</option>
            </select>
          </label>
          <label className={label}>
            Spice level
            <select
              className={input}
              value={form.spice ?? 0}
              onChange={(e) => set("spice", Number(e.target.value) as MenuItem["spice"])}
            >
              <option value={0}>None</option>
              <option value={1}>Mild</option>
              <option value={2}>Medium</option>
              <option value={3}>Hot</option>
            </select>
          </label>
        </div>

        <fieldset className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={form.popular ?? false}
              onChange={(e) => set("popular", e.target.checked)}
              className="h-5 w-5 accent-(--color-pitch)"
            />
            Player favourite
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={form.special ?? false}
              onChange={(e) => set("special", e.target.checked)}
              className="h-5 w-5 accent-(--color-pitch)"
            />
            Today&apos;s special
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={!!form.availableWindow}
              onChange={(e) => set("availableWindow", e.target.checked ? { from: "07:00", to: "11:00" } : null)}
              className="h-5 w-5 accent-(--color-pitch)"
            />
            Time-limited
          </label>
        </fieldset>

        {form.availableWindow && (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Available from
              <input
                type="time"
                className={input}
                value={form.availableWindow.from}
                onChange={(e) => set("availableWindow", { from: e.target.value, to: form.availableWindow!.to })}
              />
            </label>
            <label className={label}>
              Until
              <input
                type="time"
                className={input}
                value={form.availableWindow.to}
                onChange={(e) => set("availableWindow", { from: form.availableWindow!.from, to: e.target.value })}
              />
            </label>
          </div>
        )}

        <div className="flex items-center gap-3">
          {form.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.photo} alt="" className="h-14 w-14 rounded-ctl object-cover" />
          )}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-ctl border border-line px-3.5 py-2.5 text-sm font-bold text-ink-soft hover:text-ink">
            <ImagePlus size={16} />
            {form.photo ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) set("photo", await readPhoto(f));
              }}
            />
          </label>
          {form.photo && (
            <button type="button" onClick={() => set("photo", null)} className="text-sm font-bold text-terracotta">
              Remove
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="flex-1 rounded-ctl bg-pitch py-3.5 font-bold text-cream disabled:opacity-40"
          >
            Save item
          </button>
          {form.id && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete "${form.name}"?`)) {
                  getStore().deleteItem(form.id!);
                  onClose();
                }
              }}
              className="rounded-ctl border border-terracotta/40 px-4 py-3.5 text-sm font-bold text-terracotta"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function CategoryEditor({ cat, onClose }: { cat: Partial<Category> | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [nameNe, setNameNe] = useState("");
  const [prevCat, setPrevCat] = useState<Partial<Category> | null>(null);
  if (cat !== prevCat) {
    setPrevCat(cat);
    if (cat) {
      setName(cat.name ?? "");
      setNameNe(cat.nameNe ?? "");
    }
  }
  if (!cat) return null;

  return (
    <Sheet open onClose={onClose} title={cat.id ? "Edit category" : "New category"}>
      <div className="space-y-4 pb-2">
        <label className="block text-sm font-bold">
          Name (English)
          <input
            className="mt-1 w-full rounded-ctl border border-line bg-cream px-3.5 py-2.5 text-base outline-none focus:border-pitch-bright"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm font-bold">
          Name (नेपाली)
          <input
            className="mt-1 w-full rounded-ctl border border-line bg-cream px-3.5 py-2.5 text-base outline-none focus:border-pitch-bright"
            value={nameNe}
            onChange={(e) => setNameNe(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() => {
            getStore().upsertCategory({ id: cat.id, name: name.trim(), nameNe: nameNe.trim() });
            onClose();
          }}
          className="w-full rounded-ctl bg-pitch py-3.5 font-bold text-cream disabled:opacity-40"
        >
          Save category
        </button>
      </div>
    </Sheet>
  );
}
