"use client";

import { useState } from "react";
import { AlertTriangle, Check, Plus, Trash2 } from "lucide-react";
import { getStore } from "@/lib/store";
import { useDB } from "@/lib/useStore";
import { useStaff } from "@/components/staff/StaffShell";
import { looksLikeEmvQr } from "@/lib/nepalQr";
import type { Role, Settings } from "@/lib/types";

export default function SettingsPage() {
  const db = useDB();
  const me = useStaff();
  const [form, setForm] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const s = form ?? db.settings;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setForm({ ...s, [k]: v });

  const save = () => {
    if (form) getStore().updateSettings(form);
    setForm(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const input =
    "mt-1 w-full rounded-ctl border border-line bg-surface px-3.5 py-2.5 text-base outline-none focus:border-pitch-bright";
  const label = "block text-sm font-bold";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-8">
      <h1 className="font-display text-2xl text-pitch">Settings</h1>

      <section className="mt-5 space-y-4" aria-label="Café profile">
        <h2 className="font-display text-lg">Café profile</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Name (English)
            <input className={input} value={s.cafeName} onChange={(e) => set("cafeName", e.target.value)} />
          </label>
          <label className={label}>
            Name (नेपाली)
            <input className={input} value={s.cafeNameNe} onChange={(e) => set("cafeNameNe", e.target.value)} />
          </label>
        </div>
        <label className={label}>
          Tagline
          <input className={input} value={s.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Phone
            <input className={input} value={s.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className={label}>
            Opening hours
            <input className={input} value={s.hours} onChange={(e) => set("hours", e.target.value)} />
          </label>
        </div>
      </section>

      <section className="mt-7 space-y-4" aria-label="Billing">
        <h2 className="font-display text-lg">Billing</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            VAT %
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={30}
              className={input}
              value={s.vatPercent}
              onChange={(e) => set("vatPercent", Number(e.target.value))}
            />
            <span className="mt-1 block text-xs font-normal text-ink-faint">0 = prices shown as-is, no VAT line</span>
          </label>
          <label className={label}>
            Service charge %
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={15}
              className={input}
              value={s.serviceChargePercent}
              onChange={(e) => set("serviceChargePercent", Number(e.target.value))}
            />
          </label>
        </div>
        <p className="text-sm text-ink-soft">Currency: NPR (रू)</p>
      </section>

      <section className="mt-7" aria-label="Notifications">
        <h2 className="font-display text-lg">Notifications</h2>
        <label className="mt-3 flex items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={s.soundOn}
            onChange={(e) => set("soundOn", e.target.checked)}
            className="h-5 w-5 accent-(--color-pitch)"
          />
          Play a chime when a new order arrives
        </label>
      </section>

      <section className="mt-7 space-y-3" aria-label="Payment QR">
        <h2 className="font-display text-lg">Payment QR</h2>
        <label className="flex items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={s.paymentQr.enabled}
            onChange={(e) => set("paymentQr", { ...s.paymentQr, enabled: e.target.checked })}
            className="h-5 w-5 accent-(--color-pitch)"
          />
          Show a scan-to-pay QR with the bill amount
        </label>

        {s.paymentQr.enabled && (
          <>
            <label className="block text-sm font-bold">
              Your NepalPay / eSewa merchant QR
              <textarea
                value={s.paymentQr.staticData}
                onChange={(e) => set("paymentQr", { ...s.paymentQr, staticData: e.target.value.trim() })}
                rows={3}
                placeholder="Paste the text content of your static merchant QR (starts with 000201…)"
                className="mt-1 w-full rounded-ctl border border-line bg-surface px-3.5 py-2.5 font-mono text-xs outline-none focus:border-pitch-bright"
              />
            </label>

            {s.paymentQr.staticData &&
              (looksLikeEmvQr(s.paymentQr.staticData) ? (
                <p className="flex items-center gap-1.5 text-sm font-bold text-pitch-bright">
                  <Check size={15} /> Recognized — bills will show a QR pre-filled with the amount.
                </p>
              ) : (
                <p className="flex items-start gap-1.5 text-sm font-bold text-terracotta">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  That doesn&apos;t look like a NepalPay QR. Paste the text your merchant QR encodes.
                </p>
              ))}

            <p className="text-xs leading-relaxed text-ink-faint">
              This reuses your own merchant QR, so payments still go to your account — the customer
              just doesn&apos;t type the amount. To get the text: open any QR-scanner app, scan the
              printed QR your bank/eSewa gave you, and copy the result here. The remark is set to
              &ldquo;{s.cafeName}&rdquo; automatically. Test-scan one bill before going live.
            </p>
          </>
        )}
      </section>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!form}
          className="rounded-ctl bg-pitch px-6 py-3 font-bold text-cream disabled:opacity-40"
        >
          Save settings
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-bold text-pitch-bright">
            <Check size={16} /> Saved
          </span>
        )}
      </div>

      <StaffSection meId={me.id} />

      <section className="mt-10 border-t border-line pt-5" aria-label="Demo data">
        <h2 className="font-display text-lg text-terracotta">Demo data</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Resets menu, orders, tables, and settings back to the sample data. Only for testing.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Reset ALL data to the demo seed? Every order and menu change will be lost.")) {
              getStore().resetDemo();
            }
          }}
          className="mt-3 rounded-ctl border border-terracotta/40 px-4 py-2.5 text-sm font-bold text-terracotta hover:bg-terracotta-soft"
        >
          Reset demo data
        </button>
      </section>
    </div>
  );
}

function StaffSection({ meId }: { meId: string }) {
  const db = useDB();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("waiter");
  const [pin, setPin] = useState("");

  const pinTaken = db.staff.some((u) => u.pin === pin);
  const canAdd = name.trim() && /^\d{4}$/.test(pin) && !pinTaken;

  return (
    <section className="mt-10 border-t border-line pt-5" aria-label="Staff accounts">
      <h2 className="font-display text-lg">Staff accounts</h2>
      <ul className="mt-3 divide-y divide-line-soft rounded-card border border-line bg-surface">
        {db.staff.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <p className="font-bold">{u.name}</p>
              <p className="text-xs uppercase tracking-wide text-ink-faint">
                {u.role} · PIN {u.pin}
              </p>
            </div>
            {u.id !== meId && (
              <button
                type="button"
                aria-label={`Remove ${u.name}`}
                onClick={() => {
                  if (window.confirm(`Remove staff account "${u.name}"?`)) getStore().deleteStaff(u.id);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-ctl text-ink-faint hover:bg-terracotta-soft hover:text-terracotta"
              >
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canAdd) return;
          getStore().upsertStaff({ name: name.trim(), role, pin });
          setName("");
          setPin("");
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="min-w-0 flex-1 rounded-ctl border border-line bg-surface px-3.5 py-2.5 outline-none placeholder:text-ink-faint focus:border-pitch-bright"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          aria-label="Role"
          className="rounded-ctl border border-line bg-surface px-3 py-2.5 font-bold"
        >
          <option value="waiter">Waiter</option>
          <option value="counter">Counter</option>
          <option value="kitchen">Kitchen</option>
          <option value="admin">Admin</option>
        </select>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4-digit PIN"
          inputMode="numeric"
          className={`w-28 rounded-ctl border bg-surface px-3.5 py-2.5 outline-none placeholder:text-ink-faint ${
            pin && pinTaken ? "border-terracotta" : "border-line focus:border-pitch-bright"
          }`}
        />
        <button
          type="submit"
          disabled={!canAdd}
          className="flex items-center gap-1 rounded-ctl bg-pitch px-4 py-2.5 text-sm font-bold text-cream disabled:opacity-40"
        >
          <Plus size={15} /> Add
        </button>
      </form>
      {pin && pinTaken && <p className="mt-1.5 text-sm font-bold text-terracotta">That PIN is already in use — pick another.</p>}
    </section>
  );
}
