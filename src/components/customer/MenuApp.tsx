"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, BellRing, Clock3, ShoppingBag, Sparkles } from "lucide-react";
import type { CartLine } from "./cart";
import { ItemSheet, CartSheet } from "./Sheets";
import { OrderTracker } from "./OrderTracker";
import { DietMark, SpiceLevel, StockBadge } from "@/components/ui";
import { getStore } from "@/lib/store";
import { useDB, useHydrated, useStoredString, writeStoredString } from "@/lib/useStore";
import { loc, useLang } from "@/lib/i18n";
import { inWindow, npr } from "@/lib/format";
import type { MenuItem } from "@/lib/types";
import { isOpen } from "@/lib/types";

const orderKey = (tableId: string) => `strike-yard-order-${tableId}`;
const heroPhoto = "/food/burger.jpg";
const CATEGORY_META: Record<string, { photo: string; tone: string; kicker: string }> = {
  "cat-coffee": { photo: "/food/latte.jpg", tone: "bg-pitch", kicker: "Fresh pulls" },
  "cat-cold": { photo: "/food/lemonade.jpg", tone: "bg-pitch-bright", kicker: "Post-game chill" },
  "cat-snacks": { photo: "/food/momo.jpg", tone: "bg-saffron-deep", kicker: "Fast bites" },
  "cat-meals": { photo: "/food/dalbhat.jpg", tone: "bg-terracotta", kicker: "Full plates" },
  "cat-breakfast": { photo: "/food/pancakes.jpg", tone: "bg-saffron", kicker: "Morning only" },
};

export default function MenuApp({ tableId }: { tableId: string }) {
  const db = useDB();
  const hydrated = useHydrated();
  const { lang, setLang, t } = useLang();

  const table = db.tables.find((x) => x.id === tableId);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [openItem, setOpenItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [justPlaced, setJustPlaced] = useState(false);

  // This table's open order id persists in localStorage so a page refresh
  // (or accidental tab close) doesn't lose the tracker.
  const orderId = useStoredString("local", orderKey(tableId));
  const order = orderId ? db.orders.find((o) => o.id === orderId) ?? null : null;

  // Drop stale references (demo reset, order deleted elsewhere)
  useEffect(() => {
    if (orderId && hydrated && !order) {
      writeStoredString("local", orderKey(tableId), null);
    }
  }, [orderId, order, hydrated, tableId]);

  const categories = useMemo(
    () => [...db.categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [db.categories],
  );

  const visibleItems = useMemo(() => {
    const items = [...db.items].sort((a, b) => a.sortOrder - b.sortOrder);
    return activeCat === "all" ? items : items.filter((i) => i.categoryId === activeCat);
  }, [db.items, activeCat]);

  const popular = useMemo(
    () => db.items.filter((i) => i.popular && i.stock !== "out" && inWindow(i.availableWindow)),
    [db.items],
  );

  const cartCount = cart.reduce((n, l) => n + l.qty, 0);
  const cartTotal = cart.reduce((n, l) => n + l.qty * l.price, 0);

  const addLine = useCallback((line: CartLine) => {
    setCart((prev) => {
      const same = prev.find((l) => l.itemId === line.itemId && l.note === line.note);
      if (same) {
        return prev.map((l) => (l === same ? { ...l, qty: l.qty + line.qty } : l));
      }
      return [...prev, line];
    });
    setOpenItem(null);
  }, []);

  const submitCart = useCallback(() => {
    if (cart.length === 0) return;
    const store = getStore();
    if (order && isOpen(order)) {
      store.appendToOrder(order.id, cart);
    } else {
      const placed = store.placeOrder(tableId, cart);
      writeStoredString("local", orderKey(tableId), placed.id);
    }
    setCart([]);
    setCartOpen(false);
    setJustPlaced(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [cart, order, tableId]);

  const startNewOrder = useCallback(() => {
    setJustPlaced(false);
    writeStoredString("local", orderKey(tableId), null);
  }, [tableId]);

  const hasOpenCall = db.calls.some((c) => c.tableId === tableId && !c.resolvedAt);

  if (hydrated && !table) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-8 text-center">
        <h1 className="text-2xl">Strike Yard</h1>
        <p className="text-ink-soft">{t("scanHint")}</p>
      </main>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-line-soft bg-cream/96 shadow-[0_10px_28px_oklch(0.24_0.02_155_/_0.06)] backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <div>
            <p className="font-display text-xl leading-tight text-pitch">
              {lang === "ne" ? db.settings.cafeNameNe : db.settings.cafeName}
            </p>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
              {t("table")} {table?.label ?? "…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === "en" ? "ne" : "en")}
              className="pressable flex h-11 min-w-11 items-center justify-center rounded-ctl border border-line bg-surface px-3 text-sm font-bold text-ink-soft hover:border-pitch-bright/50 hover:text-ink"
              aria-label={lang === "en" ? "नेपालीमा हेर्नुहोस्" : "Switch to English"}
            >
              {lang === "en" ? "ने" : "EN"}
            </button>
            <button
              type="button"
              onClick={() => getStore().callWaiter(tableId)}
              disabled={hasOpenCall}
              className={`pressable flex h-11 items-center gap-1.5 rounded-ctl border px-3 text-sm font-bold ${
                hasOpenCall
                  ? "border-saffron-deep/30 bg-saffron-soft text-saffron-deep"
                  : "border-line bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {hasOpenCall ? <BellRing size={16} /> : <Bell size={16} />}
              <span className="hidden min-[380px]:inline">{hasOpenCall ? t("waiterComing") : t("callWaiter")}</span>
            </button>
          </div>
        </div>

        {/* Category chips */}
        <nav className="rail flex gap-2 overflow-x-auto px-5 pb-3" aria-label="Menu categories">
          <CatChip active={activeCat === "all"} onClick={() => setActiveCat("all")} label={t("all")} />
          {categories.map((c) => (
            <CatChip
              key={c.id}
              active={activeCat === c.id}
              onClick={() => setActiveCat(c.id)}
              label={loc(lang, c.name, c.nameNe)}
            />
          ))}
        </nav>
      </header>

      <section className="px-5 pt-5" aria-label="Featured menu">
        <div className="relative min-h-56 overflow-hidden rounded-[28px] bg-pitch text-cream shadow-[0_20px_40px_oklch(0.24_0.02_155_/_0.18)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroPhoto}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            width={900}
            height={620}
            loading="eager"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.18_0.05_148_/_0.10),oklch(0.18_0.05_148_/_0.78))]" />
          <div className="relative flex min-h-56 flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/92 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-pitch">
                <Sparkles size={13} />
                {lang === "ne" ? "आजको रोजाइ" : "Today at Strike"}
              </span>
              <span className="rounded-full bg-ink/45 px-3 py-1.5 text-xs font-bold text-cream">
                {t("table")} {table?.label ?? "..."}
              </span>
            </div>
            <div>
              <h1 className="max-w-[13ch] font-display text-[2.35rem] leading-[0.98] text-cream">
                {lang === "ne" ? "खेलपछि तातो खाना" : "Hot food after the match"}
              </h1>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream/92 px-3 py-1.5 text-xs font-bold text-pitch">
                  <Clock3 size={13} />
                  {db.settings.hours}
                </span>
                <span className="rounded-full bg-pitch-bright px-3 py-1.5 text-xs font-bold text-cream">
                  {lang === "ne" ? "किचनमा सिधै अर्डर" : "Sent straight to kitchen"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-5" aria-label="Browse menu categories">
        <div className="flex items-end justify-between px-5">
          <h2 className="font-display text-2xl leading-none text-pitch">
            {lang === "ne" ? "मेनु" : "Menu"}
          </h2>
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
            {categories.length} {lang === "ne" ? "सेक्सन" : "sections"}
          </p>
        </div>
        <div className="rail mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
          <CategoryCard
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            label={t("all")}
            kicker={lang === "ne" ? "सबै आइटम" : "Everything"}
            photo="/food/burger.jpg"
            tone="bg-pitch"
            count={db.items.length}
          />
          {categories.map((cat) => {
            const meta = CATEGORY_META[cat.id] ?? CATEGORY_META["cat-snacks"];
            return (
              <CategoryCard
                key={cat.id}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
                label={loc(lang, cat.name, cat.nameNe)}
                kicker={meta.kicker}
                photo={meta.photo}
                tone={meta.tone}
                count={db.items.filter((item) => item.categoryId === cat.id).length}
              />
            );
          })}
        </div>
      </section>

      {/* Live order tracker */}
      {order && (
        <OrderTracker
          order={order}
          highlight={justPlaced}
          onNewOrder={startNewOrder}
        />
      )}

      {/* Player favourites rail */}
      {activeCat === "all" && popular.length > 0 && (
        <section className="pt-5" aria-label={t("popular")}>
          <div className="flex items-end justify-between px-5">
            <h2 className="font-display text-2xl leading-none text-pitch">{t("popular")}</h2>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
              {lang === "ne" ? "छिटो तयार" : "Quick picks"}
            </p>
          </div>
          <div className="rail mt-3 flex gap-3 overflow-x-auto px-5 pb-2">
            {popular.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() => setOpenItem(i)}
                className="pressable group w-44 shrink-0 overflow-hidden rounded-[22px] border border-line bg-surface text-left shadow-lift hover:-translate-y-0.5 hover:border-pitch-bright/45 hover:shadow-[0_10px_24px_oklch(0.24_0.02_155_/_0.12)]"
              >
                {i.photo && (
                  <div className="relative h-28 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={i.photo}
                      alt=""
                      width={320}
                      height={200}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-2 top-2 rounded-full bg-surface/92 px-2 py-1 text-[11px] font-bold text-pitch shadow-lift">
                      ~{i.prepMin}m
                    </span>
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-2">
                    <DietMark diet={i.diet} />
                    <p className="line-clamp-2 min-h-10 text-sm font-bold leading-snug">
                      {loc(lang, i.name, i.nameNe)}
                    </p>
                  </div>
                  <p className="price mt-2 font-display text-lg text-pitch">{npr(i.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Menu list */}
      <main className="px-5">
        {(activeCat === "all" ? categories : categories.filter((c) => c.id === activeCat)).map((cat) => {
          const items = visibleItems.filter((i) => i.categoryId === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id} className="pt-7" aria-label={loc(lang, cat.name, cat.nameNe)}>
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-2xl text-pitch">{loc(lang, cat.name, cat.nameNe)}</h2>
                <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                  {items.length} {lang === "ne" ? "आइटम" : "items"}
                </span>
              </div>
              <ul className="mt-3 space-y-3">
                {items.map((i) => (
                  <MenuCard key={i.id} item={i} onOpen={() => setOpenItem(i)} />
                ))}
              </ul>
            </section>
          );
        })}
        <footer className="pt-10 pb-4 text-center text-xs text-ink-faint">
          {db.settings.tagline} · {db.settings.hours}
        </footer>
      </main>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="pressable tap-bloom flex w-full items-center justify-between rounded-[22px] bg-pitch px-5 py-4 text-cream shadow-[0_16px_34px_oklch(0.24_0.02_155_/_0.24)] hover:bg-pitch-deep"
          >
            <span className="flex items-center gap-2.5 font-bold">
              <ShoppingBag size={20} />
              {cartCount} {t("items")}
            </span>
            <span className="flex items-center gap-3">
              <span className="price font-display text-lg">{npr(cartTotal)}</span>
              <span className="text-sm font-bold uppercase tracking-wide opacity-80">{t("viewOrder")} →</span>
            </span>
          </button>
        </div>
      )}

      <ItemSheet item={openItem} onClose={() => setOpenItem(null)} onAdd={addLine} />
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        setCart={setCart}
        onSubmit={submitCart}
        appending={!!(order && isOpen(order))}
      />
    </div>
  );
}

function CatChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable h-10 shrink-0 rounded-full px-4 text-sm font-bold ${
        active ? "bg-pitch text-cream shadow-lift" : "border border-line bg-surface text-ink-soft hover:border-pitch-bright/45 hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryCard({
  active,
  onClick,
  label,
  kicker,
  photo,
  tone,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  kicker: string;
  photo: string;
  tone: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`pressable group relative h-28 w-38 shrink-0 overflow-hidden rounded-[22px] border text-left shadow-lift ${
        active ? "border-pitch-bright" : "border-line hover:border-pitch-bright/45"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        width={280}
        height={220}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
      />
      <div className={`absolute inset-0 ${tone} opacity-45 mix-blend-multiply`} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,oklch(0.18_0.05_148_/_0.04),oklch(0.18_0.05_148_/_0.78))]" />
      <div className="relative flex h-full flex-col justify-between p-3 text-cream">
        <span className="self-start rounded-full bg-surface/92 px-2 py-0.5 text-[11px] font-bold text-pitch">
          {count}
        </span>
        <span>
          <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">{kicker}</span>
          <span className="block text-base font-bold leading-tight">{label}</span>
        </span>
      </div>
    </button>
  );
}

function MenuCard({ item, onOpen }: { item: MenuItem; onOpen: () => void }) {
  const { lang, t } = useLang();
  const soldOut = item.stock === "out";
  const offHours = !inWindow(item.availableWindow);
  const disabled = soldOut || offHours;

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className={`pressable group w-full overflow-hidden rounded-[22px] border border-line bg-surface text-left shadow-lift ${
          disabled ? "opacity-55" : "hover:-translate-y-0.5 hover:border-pitch-bright/45 hover:shadow-[0_10px_24px_oklch(0.24_0.02_155_/_0.12)]"
        }`}
      >
        <div className="flex min-h-32 items-stretch">
          {item.photo && (
            <div className="relative w-31 shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.photo}
                alt=""
                width={220}
                height={220}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
              />
              {item.popular && (
                <span className="absolute left-2 top-2 rounded-full bg-surface/92 px-2 py-0.5 text-[11px] font-bold text-pitch shadow-lift">
                  Pick
                </span>
              )}
            </div>
          )}
          <div className="min-w-0 flex-1 p-3.5">
            <div className="flex items-center gap-2">
              <DietMark diet={item.diet} />
              <p className="truncate font-bold">{loc(lang, item.name, item.nameNe)}</p>
              <SpiceLevel level={item.spice} />
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-soft">
              {loc(lang, item.description, item.descriptionNe)}
            </p>
            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <p className="price font-display text-xl leading-none text-pitch">{npr(item.price)}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  <Clock3 size={12} />
                  ~{item.prepMin} min
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                {offHours && !soldOut && (
                  <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-xs font-bold text-saffron-deep">
                    {t("breakfastOnly")}
                  </span>
                )}
                <StockBadge stock={item.stock} soldOut={t("outOfStock")} fewLeft={t("lowStock")} />
                {!disabled && (
                  <span className="rounded-full bg-pitch-soft px-3 py-1.5 text-sm font-bold text-pitch">
                    {t("addToOrder")}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}
