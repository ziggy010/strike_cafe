"use client";

import { useState } from "react";
import { BadgePercent, Trash2 } from "lucide-react";
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
  promoCode,
  setPromoCode,
}: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  onSubmit: () => void;
  appending: boolean;
  promoCode: string | null;
  setPromoCode: (code: string | null) => void;
}) {
  const { lang, t } = useLang();
  const db = useDB();
  const [codeInput, setCodeInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);

  const subtotal = cart.reduce((n, l) => n + l.qty * l.price, 0);

  // Discount is recomputed live from the current subtotal, so editing the cart
  // after applying a code always keeps the amount honest.
  const promo = promoCode ? getStore().validatePromo(promoCode, subtotal) : null;
  const discount = promo?.ok ? promo.amount : 0;
  // A code that fell below its minimum after an edit: keep it, but flag it.
  const promoDropped = promoCode !== null && promo !== null && !promo.ok;

  const discounted = Math.max(0, subtotal - discount);
  const vat = Math.round((discounted * db.settings.vatPercent) / 100);
  const service = Math.round((discounted * db.settings.serviceChargePercent) / 100);
  const total = discounted + vat + service;
  const waitMin = cart.length > 0 ? getStore().estimateWait(cart) : 0;

  const setQty = (line: CartLine, qty: number) => {
    setCart((prev) => prev.map((l) => (l === line ? { ...l, qty } : l)));
  };
  const remove = (line: CartLine) => {
    setCart((prev) => prev.filter((l) => l !== line));
  };

  const applyCode = () => {
    const code = codeInput.trim();
    if (!code) return;
    const res = getStore().validatePromo(code, subtotal);
    if (res.ok) {
      setPromoCode(res.code);
      setCodeInput("");
      setPromoError(null);
    } else {
      setPromoError(
        res.reason === "min" ? t("promoMin") : res.reason === "expired" ? t("promoExpired") : t("promoInvalid"),
      );
    }
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

          {/* Promo code */}
          {!appending && (
            <div className="mt-3 border-t border-line pt-3">
              {promoCode && promo?.ok ? (
                <div className="flex items-center justify-between rounded-ctl bg-pitch-soft px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-pitch">
                    <BadgePercent size={15} />
                    {promoCode} · {t("promoApplied")}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPromoCode(null);
                      setPromoError(null);
                    }}
                    className="pressable text-sm font-bold text-ink-soft hover:text-terracotta"
                  >
                    {t("remove")}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => {
                      setCodeInput(e.target.value.toUpperCase());
                      setPromoError(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && applyCode()}
                    placeholder={t("promoPlaceholder")}
                    aria-label={t("promoCode")}
                    className="h-11 min-w-0 flex-1 rounded-ctl border border-line bg-cream px-3.5 text-[15px] uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-faint focus:border-pitch-bright"
                  />
                  <button
                    type="button"
                    onClick={applyCode}
                    disabled={!codeInput.trim()}
                    className="pressable rounded-ctl border border-pitch/30 px-4 text-sm font-bold text-pitch disabled:opacity-40"
                  >
                    {t("apply")}
                  </button>
                </div>
              )}
              {promoError && <p className="mt-1.5 text-sm font-bold text-terracotta">{promoError}</p>}
              {promoDropped && <p className="mt-1.5 text-sm font-bold text-terracotta">{t("promoMin")}</p>}
            </div>
          )}

          <dl className="price mt-2 space-y-1.5 border-t border-line pt-3 text-sm">
            {(vat > 0 || service > 0 || discount > 0) && (
              <div className="flex justify-between text-ink-soft">
                <dt>{t("subtotal")}</dt>
                <dd>{npr(subtotal)}</dd>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between font-bold text-pitch">
                <dt>
                  {t("discount")} ({promoCode})
                </dt>
                <dd>−{npr(discount)}</dd>
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
