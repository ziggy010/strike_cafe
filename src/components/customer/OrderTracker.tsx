"use client";

import { useState } from "react";
import { Check, ChefHat, HandPlatter, Inbox, Star } from "lucide-react";
import { getStore } from "@/lib/store";
import { useLang } from "@/lib/i18n";
import { npr } from "@/lib/format";
import { orderTotal } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { isOpen } from "@/lib/types";

const STEPS = [
  { status: "received", icon: Inbox, key: "statusReceived" },
  { status: "preparing", icon: ChefHat, key: "statusPreparing" },
  { status: "ready", icon: HandPlatter, key: "statusReady" },
] as const;

export function OrderTracker({
  order,
  highlight,
  onNewOrder,
}: {
  order: Order;
  highlight: boolean;
  onNewOrder: () => void;
}) {
  const { t } = useLang();

  const stepIndex =
    order.status === "received" ? 0 : order.status === "preparing" ? 1 : order.status === "ready" ? 2 : 3;
  const total = orderTotal(order);
  const waitMin = isOpen(order) && order.status !== "ready" ? getStore().estimateWait(order.lines) : 0;

  if (order.status === "cancelled") {
    return (
      <Wrap highlight={false}>
        <p className="font-bold text-terracotta">{t("statusCancelled")}</p>
        <NewOrderButton onClick={onNewOrder} label={t("startNew")} />
      </Wrap>
    );
  }

  return (
    <Wrap highlight={highlight}>
      <div className="flex items-baseline justify-between">
        <p className="font-bold">
          {t("orderCode")} <span className="font-display text-pitch">{order.code}</span>
        </p>
        <p className="price text-sm text-ink-soft">{npr(total)}</p>
      </div>

      {order.status === "served" ? (
        <>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-pitch-bright">
            <Check size={16} /> {t("statusServed")} — {t("closedOrder")}
          </p>
          <Feedback order={order} />
          <NewOrderButton onClick={onNewOrder} label={t("startNew")} />
        </>
      ) : (
        <>
          {/* Progress steps */}
          <ol className="mt-3 flex items-center" aria-label="Order progress">
            {STEPS.map((s, i) => {
              const done = i < stepIndex;
              const current = i === stepIndex;
              const Icon = s.icon;
              return (
                <li key={s.status} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center">
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                        done
                          ? "border-pitch-bright bg-pitch-bright text-cream"
                          : current
                            ? "border-saffron-deep bg-saffron-soft text-saffron-deep"
                            : "border-line bg-surface text-ink-faint"
                      }`}
                    >
                      {done ? <Check size={16} /> : <Icon size={16} />}
                    </span>
                    <span
                      className={`mt-1 text-[11px] font-bold uppercase tracking-wide ${
                        current ? "text-saffron-deep" : done ? "text-pitch-bright" : "text-ink-faint"
                      }`}
                    >
                      {t(s.key)}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className={`mx-1 mb-4 h-0.5 flex-1 rounded ${i < stepIndex ? "bg-pitch-bright" : "bg-line"}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>

          {waitMin > 0 && (
            <p className="mt-2.5 text-sm text-ink-soft">
              {t("estWait")}: ~{waitMin} {t("minutes")}
            </p>
          )}
          {order.status === "ready" && (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm font-bold text-pitch-bright">
              <Check size={16} /> {t("statusReady")}
            </p>
          )}
          <p className="mt-1.5 text-xs text-ink-faint">{t("payAtCounter")}</p>
        </>
      )}
    </Wrap>
  );
}

function Wrap({ highlight, children }: { highlight: boolean; children: React.ReactNode }) {
  return (
    <div className="px-5 pt-4">
      <div
        className={`rounded-card border bg-surface p-4 shadow-lift ${
          highlight ? "animate-slide-up border-pitch-bright/40" : "border-line"
        }`}
        role="status"
        aria-live="polite"
      >
        {children}
      </div>
    </div>
  );
}

function NewOrderButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full rounded-ctl border border-pitch/25 py-3 text-sm font-bold text-pitch transition-colors hover:bg-pitch-soft"
    >
      {label}
    </button>
  );
}

function Feedback({ order }: { order: Order }) {
  const { t } = useLang();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  if (order.feedback) {
    return <p className="mt-2 text-sm text-pitch-bright">{t("rateThanks")}</p>;
  }

  return (
    <div className="mt-3 border-t border-line-soft pt-3">
      <p className="text-sm font-bold">{t("rateOrder")}</p>
      <div className="mt-1.5 flex gap-1" role="radiogroup" aria-label={t("rateOrder")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star`}
            onClick={() => setRating(n)}
            className="flex h-11 w-11 items-center justify-center"
          >
            <Star
              size={26}
              className={n <= rating ? "text-saffron-deep" : "text-line"}
              fill={n <= rating ? "currentColor" : "none"}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("feedbackPlaceholder")}
            maxLength={200}
            className="min-w-0 flex-1 rounded-ctl border border-line bg-cream px-3 py-2.5 text-sm outline-none placeholder:text-ink-faint focus:border-pitch-bright"
          />
          <button
            type="button"
            onClick={() => getStore().submitFeedback(order.id, rating, comment.trim())}
            className="rounded-ctl bg-pitch px-4 text-sm font-bold text-cream"
          >
            {t("send")}
          </button>
        </div>
      )}
    </div>
  );
}
