"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { CartLine } from "./cart";
import { DietMark, Sheet, SpiceLevel, Stepper } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { loc, useLang } from "@/lib/i18n";
import { npr } from "@/lib/format";
import type { MenuItem } from "@/lib/types";

export function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
}) {
  const { lang, t } = useLang();
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  // Reset per item (adjust-state-during-render pattern, not an effect)
  const [prevItem, setPrevItem] = useState<MenuItem | null>(null);
  if (item !== prevItem) {
    setPrevItem(item);
    setQty(1);
    setNote("");
  }

  if (!item) return null;

  return (
    <Sheet open onClose={onClose}>
      {item.photo && (
        <div className="relative h-60 overflow-hidden bg-pitch">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.photo}
            alt=""
            width={640}
            height={420}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-12 bg-[linear-gradient(180deg,transparent,oklch(0.24_0.02_155_/_0.18))]" />
        </div>
      )}
      <div className={`${item.photo ? "relative z-10 -mt-5 rounded-t-[24px] bg-surface px-5 pt-5 shadow-[0_-10px_24px_oklch(0.24_0.02_155_/_0.08)]" : "px-5 pt-1"}`}>
        <div className="flex items-start gap-2.5">
          <DietMark diet={item.diet} className="mt-1.5" />
          <div>
            <h2 className="font-display text-2xl leading-tight">{loc(lang, item.name, item.nameNe)}</h2>
            <div className="mt-1 flex items-center gap-2">
              <p className="price font-display text-xl text-pitch">{npr(item.price)}</p>
              <SpiceLevel level={item.spice} />
            </div>
          </div>
        </div>
        <p className="mt-2 text-ink-soft">{loc(lang, item.description, item.descriptionNe)}</p>

        <label className="mt-5 block">
          <span className="text-sm font-bold">{t("noteLabel")}</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("notePlaceholder")}
            maxLength={120}
            className="mt-1.5 w-full rounded-ctl border border-line bg-cream px-4 py-3 text-base outline-none placeholder:text-ink-faint focus:border-pitch-bright"
          />
        </label>

        <div className="mt-5 flex items-center justify-between gap-4 pb-2">
          <Stepper qty={qty} onChange={setQty} />
          <button
            type="button"
            onClick={() =>
              onAdd({
                itemId: item.id,
                name: item.name,
                nameNe: item.nameNe,
                price: item.price,
                qty,
                note: note.trim(),
              })
            }
            className="pressable tap-bloom price flex-1 rounded-ctl bg-pitch px-5 py-3.5 text-base font-bold text-cream hover:bg-pitch-deep"
          >
            {t("addToOrder")} · {npr(item.price * qty)}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function CartSheet({
  open,
  onClose,
  cart,
  setCart,
  onSubmit,
  appending,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  onSubmit: () => void;
  appending: boolean;
}) {
  const { lang, t } = useLang();
  const db = useDB();

  const subtotal = cart.reduce((n, l) => n + l.qty * l.price, 0);
  const vat = Math.round((subtotal * db.settings.vatPercent) / 100);
  const service = Math.round((subtotal * db.settings.serviceChargePercent) / 100);
  const total = subtotal + vat + service;
  const waitMin = cart.length > 0 ? getStore().estimateWait(cart) : 0;

  const setQty = (line: CartLine, qty: number) => {
    setCart((prev) => prev.map((l) => (l === line ? { ...l, qty } : l)));
  };
  const remove = (line: CartLine) => {
    setCart((prev) => prev.filter((l) => l !== line));
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("yourOrder")}>
      {cart.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-bold">{t("emptyCart")}</p>
          <p className="mt-1 text-sm text-ink-soft">{t("emptyCartHint")}</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line-soft">
            {cart.map((line, idx) => (
              <li key={idx} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug">{loc(lang, line.name, line.nameNe)}</p>
                  {line.note && (
                    <p className="mt-0.5 text-sm text-saffron-deep">
                      {t("yourNote")}: {line.note}
                    </p>
                  )}
                  <p className="price mt-0.5 text-sm text-ink-soft">{npr(line.price)}</p>
                </div>
                <Stepper qty={line.qty} onChange={(q) => setQty(line, q)} />
                <button
                  type="button"
                  aria-label={`Remove ${line.name}`}
                  onClick={() => remove(line)}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
                >
                  <Trash2 size={18} />
                </button>
              </li>
            ))}
          </ul>

          <dl className="price mt-2 space-y-1.5 border-t border-line pt-3 text-sm">
            {(vat > 0 || service > 0) && (
              <div className="flex justify-between text-ink-soft">
                <dt>{t("subtotal")}</dt>
                <dd>{npr(subtotal)}</dd>
              </div>
            )}
            {vat > 0 && (
              <div className="flex justify-between text-ink-soft">
                <dt>
                  {t("vat")} ({db.settings.vatPercent}%)
                </dt>
                <dd>{npr(vat)}</dd>
              </div>
            )}
            {service > 0 && (
              <div className="flex justify-between text-ink-soft">
                <dt>
                  {t("serviceCharge")} ({db.settings.serviceChargePercent}%)
                </dt>
                <dd>{npr(service)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-bold">
              <dt>{t("total")}</dt>
              <dd className="font-display text-lg">{npr(total)}</dd>
            </div>
          </dl>

          <p className="mt-2 text-sm text-ink-soft">
            {t("estWait")}: ~{waitMin} {t("minutes")}
          </p>

          <button
            type="button"
            onClick={onSubmit}
            className="pressable tap-bloom mt-4 mb-2 w-full rounded-ctl bg-pitch py-4 text-base font-bold text-cream hover:bg-pitch-deep"
          >
            {appending ? t("addMore") : t("placeOrder")}
          </button>
        </>
      )}
    </Sheet>
  );
}
