"use client";

import Link from "next/link";
import { QrCode, UtensilsCrossed } from "lucide-react";
import { useDB, useHydrated } from "@/lib/useStore";

/**
 * Customers never land here in production — table QR codes deep-link straight
 * to /t/<tableId>. This page is the front door for staff and for demoing.
 */
export default function Home() {
  const db = useDB();
  const hydrated = useHydrated();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 py-10">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-pitch text-cream">
          <UtensilsCrossed size={28} />
        </span>
        <h1 className="mt-4 font-display text-4xl text-pitch">Strike Yard</h1>
        <p className="mt-1 text-sm font-bold uppercase tracking-widest text-ink-faint">
          {db.settings.tagline}
        </p>
        <p className="mt-6 flex items-center gap-2 text-ink-soft">
          <QrCode size={18} className="shrink-0" />
          Scan the QR code on your table to order.
        </p>
      </div>

      {hydrated && (
        <section aria-label="Demo tables" className="pb-6">
          <h2 className="text-center text-xs font-bold uppercase tracking-widest text-ink-faint">
            Demo — open a table
          </h2>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {db.tables
              .filter((t) => t.active)
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/t/${t.id}`}
                  className="flex h-11 items-center rounded-ctl border border-line bg-surface px-4 text-sm font-bold text-ink transition-colors hover:border-pitch-bright"
                >
                  {t.label}
                </Link>
              ))}
          </div>
          <p className="mt-6 text-center">
            <Link href="/staff" className="text-sm font-bold text-pitch underline underline-offset-4">
              Staff panel →
            </Link>
          </p>
        </section>
      )}
    </main>
  );
}
