"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AppliedDiscount,
  Combo,
  DB,
  Diet,
  InventoryItem,
  MenuItem,
  Order,
  OrderLine,
  OrderStatus,
  Promo,
  Settings,
  StaffUser,
  CafeTable,
  Category,
} from "./types";
import { isOpen } from "./types";
import { promoDiscount } from "./orders";
import { seedDB } from "./seed";

const LS_KEY = "strike-yard-db-v1";
const ARCHIVE_KEY = "strike-yard-archive-v1";
const CHANNEL = "strike-yard-sync";
const CLOUD_STATE_ID = "main";

// Closed orders older than today move out of the live (synced) DB into the
// archive, so the realtime blob stays small no matter how busy the café gets.
const ARCHIVE_CAP = 3000; // keep the local archive bounded
const ARCHIVE_CLOUD_DAYS = 40; // how far back to hydrate the archive from cloud

// Safety-net poll: realtime is the fast path, but events can be dropped or
// arrive without their payload, so we also re-fetch on this interval while the
// tab is visible. The synced blob is kept small by archiving, so this is cheap.
const CLOUD_POLL_MS = 4000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type AppStateRow = {
  id: string;
  data: DB;
  updated_at?: string;
};

function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function normalizeSupabaseUrl(url: string): string {
  return url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

/**
 * Union two lists by id, keeping whichever record ranks higher (newer). Used to
 * reconcile a cloud snapshot with local state so neither side loses a change:
 * a just-placed local order that isn't in the cloud yet is kept, and a status
 * update from another device wins by its newer timestamp.
 */
function mergeById<T extends { id: string }>(local: T[], incoming: T[], rank: (x: T) => number): T[] {
  const m = new Map<string, T>();
  for (const x of local) m.set(x.id, x);
  for (const x of incoming) {
    const cur = m.get(x.id);
    if (!cur || rank(x) >= rank(cur)) m.set(x.id, x);
  }
  return [...m.values()];
}

/**
 * Browser data store.
 *
 * Without Supabase env vars, this is demo-mode localStorage + BroadcastChannel.
 * With Supabase env vars, the whole DB is synced through one shared Realtime row
 * so customer phones, kitchen, and owner/counter screens see the same orders.
 */
class Store {
  private db: DB;
  private archive: Order[] = [];
  private listeners = new Set<() => void>();
  private bc: BroadcastChannel | null = null;
  private supabase: SupabaseClient | null = null;
  private cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingCloud = false;
  private refetchQueued = false; // an event arrived while a fetch was in flight
  private pendingSave = false; // local has unsynced changes; don't let cloud clobber them
  private saveSeq = 0; // latest queued save; guards pendingSave against stale completions

  constructor() {
    this.db = this.load();
    this.archive = this.loadArchive();
    this.rollArchiveOnLoad();
    if (typeof window !== "undefined") {
      this.supabase = this.createSupabaseClient();
      void this.loadCloudSnapshot();
      void this.loadArchiveFromCloud();
      this.subscribeToCloudChanges();
      this.startCloudPolling();

      if ("BroadcastChannel" in window) {
        this.bc = new BroadcastChannel(CHANNEL);
        this.bc.onmessage = () => {
          this.db = this.load();
          this.archive = this.loadArchive();
          this.emit();
        };
      }
      window.addEventListener("storage", (e) => {
        if (e.key === LS_KEY) this.db = this.load();
        if (e.key === ARCHIVE_KEY) this.archive = this.loadArchive();
        if (e.key === LS_KEY || e.key === ARCHIVE_KEY) this.emit();
      });
    }
  }

  private load(): DB {
    if (typeof window === "undefined") return seedDB();
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) return this.withMigrations(JSON.parse(raw) as DB);
    } catch {
      // corrupted storage falls through to a fresh seed
    }
    const fresh = seedDB();
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(fresh));
    } catch {}
    return fresh;
  }

  private withMigrations(db: DB): DB {
    const seed = seedDB();
    if (!db.categories?.length) db.categories = seed.categories;
    if (!db.items?.length) db.items = seed.items;
    if (!db.tables?.length) db.tables = seed.tables;
    if (!db.staff?.length) db.staff = seed.staff;
    if (!db.inventory?.length) db.inventory = seed.inventory;
    if (!db.settings) db.settings = seed.settings;
    db.settings.paymentQr ??= seed.settings.paymentQr;
    if (!Array.isArray(db.orders)) db.orders = [];
    if (!Array.isArray(db.calls)) db.calls = [];
    if (!Array.isArray(db.inventoryLogs)) db.inventoryLogs = [];
    // Combos & promos added in a later version; seed them for existing installs.
    if (!Array.isArray(db.combos)) db.combos = seed.combos;
    if (!Array.isArray(db.promos)) db.promos = seed.promos;
    db.orders.forEach((o) => {
      o.discount ??= null;
    });
    db.calls.forEach((call) => {
      call.acceptedAt ??= null;
      call.acceptedBy ??= null;
    });

    if (!db.staff.some((u) => u.id === "u-counter")) {
      db.staff.push({ id: "u-counter", name: "Counter", role: "counter", pin: "4444" });
    }
    return db;
  }

  private createSupabaseClient(): SupabaseClient | null {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createClient(normalizeSupabaseUrl(SUPABASE_URL), SUPABASE_ANON_KEY.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private persistLocal(db: DB): void {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch {}
  }

  // ---- Order archive (kept out of the synced blob) ----

  private loadArchive(): Order[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(ARCHIVE_KEY);
      if (raw) return JSON.parse(raw) as Order[];
    } catch {}
    return [];
  }

  private persistArchive(): void {
    try {
      window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(this.archive));
    } catch {}
  }

  /** Remove closed orders from before today out of the live DB and return them. */
  private extractArchivable(db: DB): Order[] {
    const cutoff = startOfToday();
    const archivable = db.orders.filter((o) => !isOpen(o) && o.placedAt < cutoff);
    if (archivable.length > 0) {
      const ids = new Set(archivable.map((o) => o.id));
      db.orders = db.orders.filter((o) => !ids.has(o.id));
    }
    return archivable;
  }

  private pushToArchive(orders: Order[]): void {
    const byId = new Map(this.archive.map((o) => [o.id, o]));
    for (const o of orders) byId.set(o.id, o);
    this.archive = [...byId.values()]
      .sort((a, b) => b.placedAt - a.placedAt)
      .slice(0, ARCHIVE_CAP);
    this.persistArchive();
    void this.saveArchiveToCloud(orders);
  }

  private rollArchiveOnLoad(): void {
    const archived = this.extractArchivable(this.db);
    if (archived.length === 0) return;
    this.pushToArchive(archived);
    this.persistLocal(this.db);
    this.queueCloudSave(this.db);
  }

  private async saveArchiveToCloud(orders: Order[]): Promise<void> {
    if (!this.supabase || orders.length === 0) return;
    const rows = orders.map((o) => ({
      id: o.id,
      data: o,
      placed_at: new Date(o.placedAt).toISOString(),
    }));
    const { error } = await this.supabase.from("order_archive").upsert(rows);
    if (error) {
      console.warn("Strike Yard archive sync failed; archive remains on this device.", error.message);
    }
  }

  private async loadArchiveFromCloud(): Promise<void> {
    if (!this.supabase) return;
    const since = new Date(Date.now() - ARCHIVE_CLOUD_DAYS * 86400000).toISOString();
    const { data, error } = await this.supabase
      .from("order_archive")
      .select("data")
      .gte("placed_at", since)
      .order("placed_at", { ascending: false })
      .limit(ARCHIVE_CAP);

    if (error) {
      console.warn("Strike Yard archive is unavailable from cloud; using this device only.", error.message);
      return;
    }
    if (!data?.length) return;

    const byId = new Map(this.archive.map((o) => [o.id, o]));
    for (const row of data as { data: Order }[]) byId.set(row.data.id, row.data);
    this.archive = [...byId.values()]
      .sort((a, b) => b.placedAt - a.placedAt)
      .slice(0, ARCHIVE_CAP);
    this.persistArchive();
    this.emit();
  }

  private async loadCloudSnapshot(): Promise<void> {
    if (!this.supabase) return;
    // Coalesce concurrent fetches; remember if another was requested meanwhile.
    if (this.loadingCloud) {
      this.refetchQueued = true;
      return;
    }
    this.loadingCloud = true;

    const { data, error } = await this.supabase
      .from("app_state")
      .select("data")
      .eq("id", CLOUD_STATE_ID)
      .maybeSingle<AppStateRow>();

    this.loadingCloud = false;
    if (error) {
      console.warn("Strike Yard cloud sync is unavailable; using this device only.", error.message);
    } else if (data?.data) {
      this.applyIncoming(this.withMigrations(data.data));
    } else {
      await this.saveCloudSnapshot(this.db); // no row yet: seed it
    }

    if (this.refetchQueued) {
      this.refetchQueued = false;
      void this.loadCloudSnapshot();
    }
  }

  /**
   * Reconcile a cloud snapshot with local state. Orders and calls merge by id
   * (newest wins), so an update from another device is picked up while a local
   * order that hasn't been saved yet is never dropped. Menu/settings/etc. take
   * the cloud version unless this device has an unsynced edit pending.
   */
  private applyIncoming(incoming: DB): void {
    const local = this.db;
    const orders = mergeById(local.orders, incoming.orders, (o) => o.updatedAt);
    const calls = mergeById(local.calls, incoming.calls, (c) =>
      Math.max(c.createdAt, c.acceptedAt ?? 0, c.resolvedAt ?? 0),
    );
    const base = this.pendingSave ? local : incoming;
    this.db = { ...base, orders, calls };

    const archived = this.extractArchivable(this.db);
    this.persistLocal(this.db);
    if (archived.length > 0) {
      this.pushToArchive(archived);
      this.queueCloudSave(this.db);
    }
    this.emit();
  }

  private subscribeToCloudChanges(): void {
    if (!this.supabase) return;

    this.supabase
      .channel("strike-yard-app-state")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_state",
          filter: `id=eq.${CLOUD_STATE_ID}`,
        },
        // Realtime payloads can arrive without the large jsonb column, so we use
        // the event only as a trigger and re-fetch the authoritative row.
        () => void this.loadCloudSnapshot(),
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `Strike Yard realtime status: ${status}. Falling back to ${CLOUD_POLL_MS / 1000}s polling. ` +
              "Enable Realtime for the app_state table in Supabase for instant updates.",
          );
        }
      });
  }

  private startCloudPolling(): void {
    if (!this.supabase || typeof document === "undefined") return;
    setInterval(() => {
      if (document.visibilityState === "visible") void this.loadCloudSnapshot();
    }, CLOUD_POLL_MS);
    // Catch up immediately when the screen is brought back to the foreground.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void this.loadCloudSnapshot();
    });
  }

  private queueCloudSave(db: DB): void {
    if (!this.supabase) return;
    this.pendingSave = true; // local is ahead of cloud until this flushes
    const seq = ++this.saveSeq;
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.cloudSaveTimer = setTimeout(() => {
      void this.saveCloudSnapshot(db, seq);
    }, 120);
  }

  private async saveCloudSnapshot(db: DB, seq: number = ++this.saveSeq): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase.from("app_state").upsert({
      id: CLOUD_STATE_ID,
      data: db,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      // Keep pendingSave true so a stale cloud snapshot can't overwrite the
      // local changes we failed to push; the next mutation retries the save.
      console.warn("Strike Yard cloud sync save failed; changes remain on this device.", error.message);
      return;
    }
    // Only "all clear" if no newer save was queued while this one was in flight.
    if (seq === this.saveSeq) this.pendingSave = false;
  }

  private mutate(fn: (db: DB) => void): void {
    const next = structuredClone(this.db);
    fn(next);
    const archived = this.extractArchivable(next);
    this.db = next;
    this.persistLocal(next);
    this.queueCloudSave(next);
    if (archived.length > 0) this.pushToArchive(archived);
    this.bc?.postMessage("update");
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  getSnapshot = (): DB => this.db;

  /** Archived (closed, past-day) orders. Kept out of the synced blob; used by reports. */
  getArchiveSnapshot = (): Order[] => this.archive;

  resetDemo(): void {
    this.archive = [];
    this.persistArchive();
    this.mutate((db) => Object.assign(db, seedDB()));
  }

  // ---- Orders ----

  placeOrder(
    tableId: string,
    lines: Omit<OrderLine, "batch">[],
    discount: AppliedDiscount | null = null,
  ): Order {
    const placed: Order = {
      id: uid(),
      code: this.nextCode(),
      tableId,
      lines: lines.map((l) => ({ ...l, batch: 1 })),
      status: "received",
      batches: 1,
      paid: false,
      paymentMethod: null,
      servedBy: null,
      placedAt: Date.now(),
      updatedAt: Date.now(),
      statusAt: { received: Date.now() },
      feedback: null,
      discount,
    };
    this.mutate((db) => db.orders.push(placed));
    return placed;
  }

  /** Validate a customer-entered promo code against a cart subtotal. */
  validatePromo(
    code: string,
    subtotal: number,
  ): { ok: true; code: string; amount: number } | { ok: false; reason: "notfound" | "inactive" | "expired" | "min" } {
    const promo = this.db.promos.find((p) => p.code.toLowerCase() === code.trim().toLowerCase());
    if (!promo) return { ok: false, reason: "notfound" };
    const res = promoDiscount(promo, subtotal);
    if (!res.ok) return { ok: false, reason: res.reason };
    return { ok: true, code: promo.code, amount: res.amount };
  }

  private nextCode(): string {
    const today = startOfToday();
    const n = this.db.orders.filter((o) => o.placedAt >= today).length + 1;
    return `K${n}`;
  }

  /** Customer adds a new round of items to an open order. */
  appendToOrder(orderId: string, lines: Omit<OrderLine, "batch">[]): void {
    this.mutate((db) => {
      const o = db.orders.find((x) => x.id === orderId);
      if (!o || !isOpen(o)) return;
      const batch = o.batches + 1;
      o.batches = batch;
      o.lines.push(...lines.map((l) => ({ ...l, batch })));
      // New food re-enters the kitchen queue
      if (o.status === "ready") o.status = "preparing";
      o.updatedAt = Date.now();
    });
  }

  setOrderStatus(orderId: string, status: OrderStatus, byUserId?: string): void {
    this.mutate((db) => {
      const o = db.orders.find((x) => x.id === orderId);
      if (!o) return;
      o.status = status;
      o.statusAt[status] = Date.now();
      o.updatedAt = Date.now();
      if (status === "served" && byUserId) o.servedBy = byUserId;
    });
  }

  markPaid(orderId: string, method: "cash" | "counter-qr"): void {
    this.mutate((db) => {
      const o = db.orders.find((x) => x.id === orderId);
      if (!o) return;
      o.paid = true;
      o.paymentMethod = method;
      o.updatedAt = Date.now();
    });
  }

  submitFeedback(orderId: string, rating: number, comment: string): void {
    this.mutate((db) => {
      const o = db.orders.find((x) => x.id === orderId);
      if (o) o.feedback = { rating, comment };
    });
  }

  /** Minutes until food likely arrives: longest prep in the order + kitchen queue pressure. */
  estimateWait(lines: { itemId: string; qty: number }[]): number {
    const byId = new Map(this.db.items.map((i) => [i.id, i]));
    const base = Math.max(5, ...lines.map((l) => byId.get(l.itemId)?.prepMin ?? 10));
    const queue = this.db.orders.filter(
      (o) => o.status === "received" || o.status === "preparing",
    ).length;
    return base + Math.min(20, queue * 3);
  }

  // ---- Waiter calls ----

  callWaiter(tableId: string): void {
    this.mutate((db) => {
      const open = db.calls.some((c) => c.tableId === tableId && !c.resolvedAt);
      if (open) return; // one open call per table
      db.calls.push({
        id: uid(),
        tableId,
        createdAt: Date.now(),
        acceptedAt: null,
        acceptedBy: null,
        resolvedAt: null,
        resolvedBy: null,
      });
    });
  }

  acceptCall(callId: string, byUserId: string): void {
    this.mutate((db) => {
      const c = db.calls.find((x) => x.id === callId);
      if (c && !c.resolvedAt) {
        c.acceptedAt = Date.now();
        c.acceptedBy = byUserId;
      }
    });
  }

  resolveCall(callId: string, byUserId: string): void {
    this.mutate((db) => {
      const c = db.calls.find((x) => x.id === callId);
      if (c) {
        c.acceptedAt ??= Date.now();
        c.acceptedBy ??= byUserId;
        c.resolvedAt = Date.now();
        c.resolvedBy = byUserId;
      }
    });
  }

  // ---- Menu ----

  upsertItem(input: Partial<MenuItem> & { name: string; categoryId: string; price: number }): void {
    this.mutate((db) => {
      if (input.id) {
        const idx = db.items.findIndex((i) => i.id === input.id);
        if (idx >= 0) db.items[idx] = { ...db.items[idx], ...input };
        return;
      }
      const maxSort = Math.max(-1, ...db.items.filter((i) => i.categoryId === input.categoryId).map((i) => i.sortOrder));
      db.items.push({
        id: uid(),
        nameNe: "",
        description: "",
        descriptionNe: "",
        photo: null,
        diet: "none" as Diet,
        spice: 0,
        stock: "in",
        sortOrder: maxSort + 1,
        popular: false,
        special: false,
        prepMin: 10,
        availableWindow: null,
        ...input,
      } as MenuItem);
    });
  }

  deleteItem(id: string): void {
    this.mutate((db) => {
      db.items = db.items.filter((i) => i.id !== id);
    });
  }

  setStock(id: string, stock: MenuItem["stock"]): void {
    this.mutate((db) => {
      const i = db.items.find((x) => x.id === id);
      if (i) i.stock = stock;
    });
  }

  moveItem(id: string, dir: -1 | 1): void {
    this.mutate((db) => {
      const item = db.items.find((i) => i.id === id);
      if (!item) return;
      const siblings = db.items
        .filter((i) => i.categoryId === item.categoryId)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = siblings.findIndex((i) => i.id === id);
      const swap = siblings[idx + dir];
      if (!swap) return;
      [item.sortOrder, swap.sortOrder] = [swap.sortOrder, item.sortOrder];
    });
  }

  upsertCategory(input: { id?: string; name: string; nameNe: string }): void {
    this.mutate((db) => {
      if (input.id) {
        const c = db.categories.find((x) => x.id === input.id);
        if (c) Object.assign(c, input);
        return;
      }
      db.categories.push({
        id: uid(),
        name: input.name,
        nameNe: input.nameNe,
        sortOrder: Math.max(-1, ...db.categories.map((c) => c.sortOrder)) + 1,
      });
    });
  }

  deleteCategory(id: string): void {
    this.mutate((db) => {
      db.categories = db.categories.filter((c) => c.id !== id);
      db.items = db.items.filter((i) => i.categoryId !== id);
    });
  }

  moveCategory(id: string, dir: -1 | 1): void {
    this.mutate((db) => {
      const sorted = db.categories.sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = sorted.findIndex((c) => c.id === id);
      const swap = sorted[idx + dir];
      if (!swap) return;
      [sorted[idx].sortOrder, swap.sortOrder] = [swap.sortOrder, sorted[idx].sortOrder];
    });
  }

  // ---- Combos & promos ----

  upsertCombo(input: Partial<Combo> & { name: string; price: number; itemIds: string[] }): void {
    this.mutate((db) => {
      if (input.id) {
        const idx = db.combos.findIndex((c) => c.id === input.id);
        if (idx >= 0) db.combos[idx] = { ...db.combos[idx], ...input };
        return;
      }
      db.combos.push({
        id: uid(),
        nameNe: "",
        photo: null,
        active: true,
        popular: false,
        ...input,
      } as Combo);
    });
  }

  deleteCombo(id: string): void {
    this.mutate((db) => {
      db.combos = db.combos.filter((c) => c.id !== id);
    });
  }

  upsertPromo(input: Partial<Promo> & { code: string; kind: Promo["kind"]; value: number }): void {
    this.mutate((db) => {
      const code = input.code.trim().toUpperCase();
      if (input.id) {
        const idx = db.promos.findIndex((p) => p.id === input.id);
        if (idx >= 0) db.promos[idx] = { ...db.promos[idx], ...input, code };
        return;
      }
      db.promos.push({
        id: uid(),
        minSubtotal: 0,
        active: true,
        expiresAt: null,
        ...input,
        code,
      } as Promo);
    });
  }

  deletePromo(id: string): void {
    this.mutate((db) => {
      db.promos = db.promos.filter((p) => p.id !== id);
    });
  }

  // ---- Tables ----

  addTable(label: string): void {
    this.mutate((db) => db.tables.push({ id: uid(), label, active: true }));
  }

  updateTable(id: string, patch: Partial<CafeTable>): void {
    this.mutate((db) => {
      const t = db.tables.find((x) => x.id === id);
      if (t) Object.assign(t, patch);
    });
  }

  removeTable(id: string): void {
    this.mutate((db) => {
      db.tables = db.tables.filter((t) => t.id !== id);
    });
  }

  // ---- Inventory ----

  upsertInventory(input: Partial<InventoryItem> & { name: string; unit: string }): void {
    this.mutate((db) => {
      if (input.id) {
        const i = db.inventory.find((x) => x.id === input.id);
        if (i) Object.assign(i, input);
        return;
      }
      db.inventory.push({ id: uid(), qty: 0, lowThreshold: 0, ...input } as InventoryItem);
    });
  }

  adjustInventory(id: string, delta: number, reason: string, by: string): void {
    this.mutate((db) => {
      const i = db.inventory.find((x) => x.id === id);
      if (!i) return;
      i.qty = Math.max(0, i.qty + delta);
      db.inventoryLogs.unshift({ id: uid(), inventoryId: id, delta, reason, by, at: Date.now() });
      db.inventoryLogs = db.inventoryLogs.slice(0, 200);
    });
  }

  deleteInventory(id: string): void {
    this.mutate((db) => {
      db.inventory = db.inventory.filter((i) => i.id !== id);
    });
  }

  // ---- Staff & settings ----

  loginByPin(pin: string): StaffUser | null {
    return this.db.staff.find((u) => u.pin === pin) ?? null;
  }

  upsertStaff(input: Partial<StaffUser> & { name: string; role: StaffUser["role"]; pin: string }): void {
    this.mutate((db) => {
      if (input.id) {
        const u = db.staff.find((x) => x.id === input.id);
        if (u) Object.assign(u, input);
        return;
      }
      db.staff.push({ id: uid(), ...input } as StaffUser);
    });
  }

  deleteStaff(id: string): void {
    this.mutate((db) => {
      db.staff = db.staff.filter((u) => u.id !== id);
    });
  }

  updateSettings(patch: Partial<Settings>): void {
    this.mutate((db) => Object.assign(db.settings, patch));
  }
}

// Singleton per browsing context; server render uses a stable seed snapshot.
let _store: Store | null = null;
export function getStore(): Store {
  if (!_store) _store = new Store();
  return _store;
}

const serverSnapshot: DB = seedDB();
export function getServerSnapshot(): DB {
  return serverSnapshot;
}

export type { Category, MenuItem, Order, OrderStatus };
