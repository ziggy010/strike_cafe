"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  BellRing,
  Boxes,
  ChefHat,
  ClipboardList,
  LogOut,
  QrCode,
  ReceiptText,
  Settings as SettingsIcon,
  UtensilsCrossed,
} from "lucide-react";
import { getStore } from "@/lib/store";
import { useDB, useHydrated, useStoredString, writeStoredString } from "@/lib/useStore";
import type { Role, StaffUser } from "@/lib/types";

const SESSION_KEY = "strike-yard-staff";

const StaffContext = createContext<StaffUser | null>(null);
export function useStaff(): StaffUser {
  const u = useContext(StaffContext);
  if (!u) throw new Error("useStaff outside StaffShell");
  return u;
}

const NAV: { href: string; label: string; icon: typeof ChefHat; roles: Role[] }[] = [
  { href: "/staff", label: "Orders", icon: ClipboardList, roles: ["admin", "waiter", "kitchen"] },
  { href: "/staff/kitchen", label: "Kitchen", icon: ChefHat, roles: ["admin", "kitchen"] },
  { href: "/staff/billing", label: "Billing", icon: ReceiptText, roles: ["admin", "counter"] },
  { href: "/staff/menu", label: "Menu", icon: UtensilsCrossed, roles: ["admin"] },
  { href: "/staff/tables", label: "Tables", icon: QrCode, roles: ["admin", "waiter"] },
  { href: "/staff/reports", label: "Reports", icon: BarChart3, roles: ["admin"] },
  { href: "/staff/inventory", label: "Inventory", icon: Boxes, roles: ["admin"] },
  { href: "/staff/settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
];

export default function StaffShell({ children }: { children: React.ReactNode }) {
  const db = useDB();
  const hydrated = useHydrated();
  const pathname = usePathname();
  const router = useRouter();
  const userId = useStoredString("session", SESSION_KEY);

  const user = useMemo(
    () => db.staff.find((u) => u.id === userId) ?? null,
    [db.staff, userId],
  );

  // New-order chime (not on the kitchen display, which has its own visual emphasis)
  const openCount = db.orders.filter((o) => o.status === "received").length;
  const prevCount = useRef(openCount);
  useEffect(() => {
    if (user && db.settings.soundOn && openCount > prevCount.current) orderChime();
    prevCount.current = openCount;
  }, [openCount, user, db.settings.soundOn]);

  const pendingCalls = db.calls.filter((c) => !c.resolvedAt).length;
  const unacceptedCalls = db.calls.filter((c) => !c.resolvedAt && !c.acceptedAt).length;
  const prevCallCount = useRef(unacceptedCalls);
  useEffect(() => {
    if (user && db.settings.soundOn && unacceptedCalls > prevCallCount.current) waiterCallChime();
    prevCallCount.current = unacceptedCalls;
  }, [unacceptedCalls, user, db.settings.soundOn]);

  useEffect(() => {
    if (!user || !db.settings.soundOn || unacceptedCalls === 0) return;
    const interval = window.setInterval(waiterCallChime, 30000);
    return () => window.clearInterval(interval);
  }, [unacceptedCalls, user, db.settings.soundOn]);

  if (!hydrated) {
    return <div className="flex min-h-dvh items-center justify-center text-ink-faint">Loading…</div>;
  }

  if (!user) {
    return (
      <Login
        onLogin={(u) => {
          writeStoredString("session", SESSION_KEY, u.id);
          if (u.role === "kitchen") router.push("/staff/kitchen");
          if (u.role === "counter") router.push("/staff/billing");
        }}
      />
    );
  }

  const nav = NAV.filter((n) => n.roles.includes(user.role));
  const isKDS = pathname === "/staff/kitchen" && user.role === "kitchen";
  // Kitchen display runs full-bleed without the shell chrome
  if (isKDS) {
    return <StaffContext.Provider value={user}>{children}</StaffContext.Provider>;
  }

  return (
    <StaffContext.Provider value={user}>
      <div className="flex min-h-dvh w-full">
        {/* Sidebar ≥1024px */}
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <div className="px-5 py-5">
            <p className="font-display text-lg text-pitch">{db.settings.cafeName}</p>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Staff panel</p>
          </div>
          <nav className="flex-1 space-y-0.5 px-3">
            {nav.map((n) => (
              <NavLink key={n.href} {...n} active={pathname === n.href} badge={n.href === "/staff" ? pendingCalls : 0} />
            ))}
          </nav>
          <div className="border-t border-line-soft px-5 py-4">
            <p className="text-sm font-bold">{user.name}</p>
            <p className="text-xs uppercase tracking-wide text-ink-faint">{user.role}</p>
            <button
              type="button"
              onClick={() => {
                writeStoredString("session", SESSION_KEY, null);
              }}
              className="pressable mt-2 flex items-center gap-1.5 text-sm font-bold text-ink-soft hover:text-terracotta"
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
            <p className="font-display text-base text-pitch">{db.settings.cafeName}</p>
            <button
              type="button"
              onClick={() => {
                writeStoredString("session", SESSION_KEY, null);
              }}
              aria-label="Log out"
              className="flex h-10 w-10 items-center justify-center rounded-ctl text-ink-soft"
            >
              <LogOut size={18} />
            </button>
          </header>

          <main className="flex-1 pb-24 lg:pb-8">{children}</main>

          {/* Mobile bottom tabs (max 5) */}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
            {nav.slice(0, 5).map((n) => {
              const Icon = n.icon;
              const active = pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                className={`pressable relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
                    active ? "text-pitch" : "text-ink-faint"
                  }`}
                >
                  <Icon size={20} />
                  {n.label}
                  {n.href === "/staff" && pendingCalls > 0 && (
                    <span className="absolute top-1 right-[calc(50%-1.4rem)] flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] text-cream">
                      {pendingCalls}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </StaffContext.Provider>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: typeof ChefHat;
  active: boolean;
  badge: number;
}) {
  return (
    <Link
      href={href}
      className={`pressable flex items-center gap-2.5 rounded-ctl px-3 py-2.5 text-sm font-bold ${
        active ? "bg-pitch text-cream" : "text-ink-soft hover:bg-cream hover:text-ink"
      }`}
    >
      <Icon size={17} />
      {label}
      {badge > 0 && (
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 text-xs text-cream">
          {badge}
        </span>
      )}
    </Link>
  );
}

function Login({ onLogin }: { onLogin: (u: StaffUser) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const tryPin = (value: string) => {
    setPin(value);
    setError(false);
    if (value.length === 4) {
      const u = getStore().loginByPin(value);
      if (u) onLogin(u);
      else {
        setError(true);
        setPin("");
      }
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-8">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pitch text-cream">
        <BellRing size={24} />
      </span>
      <h1 className="mt-4 font-display text-2xl text-pitch">Staff login</h1>
      <p className="mt-1 text-sm text-ink-soft">Enter your 4-digit PIN</p>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        maxLength={4}
        value={pin}
        onChange={(e) => tryPin(e.target.value.replace(/\D/g, ""))}
        aria-label="Staff PIN"
        className={`mt-5 w-40 rounded-ctl border-2 bg-surface px-4 py-3.5 text-center font-display text-2xl tracking-[0.5em] outline-none ${
          error ? "border-terracotta" : "border-line focus:border-pitch-bright"
        }`}
      />
      {error && <p className="mt-2 text-sm font-bold text-terracotta">Wrong PIN — try again.</p>}
      <p className="mt-6 text-center text-xs text-ink-faint">
        Demo PINs — Owner 1234 · Kitchen 2222 · Waiter 3333 · Counter 4444
      </p>
    </main>
  );
}

/** Two-tone order chime via WebAudio; no asset download needed. */
function orderChime(): void {
  playChime([880, 1174.66], 0.18, 0.25);
}

/** Warmer triple-ping so waiter calls feel distinct from kitchen orders. */
function waiterCallChime(): void {
  playChime([659.25, 830.61, 659.25], 0.14, 0.22);
}

function playChime(frequencies: number[], gap: number, volume: number): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * gap);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * gap);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + i * gap + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * gap + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * gap);
      osc.stop(ctx.currentTime + i * gap + 0.16);
    });
  } catch {
    // audio blocked until first user gesture — fine, the visual badge still updates
  }
}
