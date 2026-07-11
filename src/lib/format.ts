/** NPR price, no decimals (menu prices are whole rupees). */
export function npr(amount: number): string {
  return `रू ${amount.toLocaleString("en-IN")}`;
}

export function timeAgo(ts: number, now: number = Date.now()): string {
  const mins = Math.floor((now - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return new Date(ts).toLocaleDateString();
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Elapsed mm:ss for kitchen tickets. */
export function elapsed(ts: number, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** "07:00"–"11:00" window check against local time. */
export function inWindow(win: { from: string; to: string } | null, d: Date = new Date()): boolean {
  if (!win) return true;
  const cur = d.getHours() * 60 + d.getMinutes();
  const [fh, fm] = win.from.split(":").map(Number);
  const [th, tm] = win.to.split(":").map(Number);
  return cur >= fh * 60 + fm && cur <= th * 60 + tm;
}
