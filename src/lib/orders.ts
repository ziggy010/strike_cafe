import type { Order, OrderLine, Promo, Settings } from "./types";

/** Sum of line items before any discount. */
export function linesSubtotal(lines: Pick<OrderLine, "qty" | "price">[]): number {
  return lines.reduce((n, l) => n + l.qty * l.price, 0);
}

/** What the customer actually pays: subtotal minus promo and counter discounts. */
export function orderTotal(order: Order): number {
  return Math.max(
    0,
    linesSubtotal(order.lines) - (order.discount?.amount ?? 0) - (order.counterDiscount?.amount ?? 0),
  );
}

/** Final amount collected after configured service charge and VAT. */
export function orderGrandTotal(order: Order, settings: Pick<Settings, "serviceChargePercent" | "vatPercent">): number {
  const subtotal = orderTotal(order);
  const service = Math.round((subtotal * settings.serviceChargePercent) / 100);
  const vat = Math.round((subtotal * settings.vatPercent) / 100);
  return subtotal + service + vat;
}

export function promoExpired(promo: Promo, now: number = Date.now()): boolean {
  return promo.expiresAt != null && promo.expiresAt < now;
}

export type PromoResult =
  | { ok: true; amount: number }
  | { ok: false; reason: "inactive" | "expired" | "min" };

/** Evaluate a promo against a cart subtotal. Amount is capped at the subtotal. */
export function promoDiscount(promo: Promo, subtotal: number, now: number = Date.now()): PromoResult {
  if (!promo.active) return { ok: false, reason: "inactive" };
  if (promo.expiresAt && promo.expiresAt < now) return { ok: false, reason: "expired" };
  if (subtotal < promo.minSubtotal) return { ok: false, reason: "min" };
  const raw = promo.kind === "percent" ? Math.round((subtotal * promo.value) / 100) : promo.value;
  return { ok: true, amount: Math.max(0, Math.min(raw, subtotal)) };
}
