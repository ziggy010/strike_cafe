"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  DB,
  Diet,
  InventoryItem,
  MenuItem,
  Order,
  OrderLine,
  OrderStatus,
  Settings,
  StaffUser,
  CafeTable,
  Category,
} from "./types";
import { isOpen } from "./types";
import { seedDB } from "./seed";

const LS_KEY = "strike-yard-db-v1";
const CHANNEL = "strike-yard-sync";
const CLOUD_STATE_ID = "main";
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
 * Browser data store.
 *
 * Without Supabase env vars, this is demo-mode localStorage + BroadcastChannel.
 * With Supabase env vars, the whole DB is synced through one shared Realtime row
 * so customer phones, kitchen, and owner/counter screens see the same orders.
 */
class Store {
  private db: DB;
  private listeners = new Set<() => void>();
  private bc: BroadcastChannel | null = null;
  private supabase: SupabaseClient | null = null;
  private cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private loadingCloud = false;

  constructor() {
    this.db = this.load();
    if (typeof window !== "undefined") {
      this.supabase = this.createSupabaseClient();
      void this.loadCloudSnapshot();
      this.subscribeToCloudChanges();

      if ("BroadcastChannel" in window) {
        this.bc = new BroadcastChannel(CHANNEL);
        this.bc.onmessage = () => {
          this.db = this.load();
          this.emit();
        };
      }
      window.addEventListener("storage", (e) => {
        if (e.key === LS_KEY) {
          this.db = this.load();
          this.emit();
        }
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
    if (!Array.isArray(db.orders)) db.orders = [];
    if (!Array.isArray(db.calls)) db.calls = [];
    if (!Array.isArray(db.inventoryLogs)) db.inventoryLogs = [];

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

  private async loadCloudSnapshot(): Promise<void> {
    if (!this.supabase || this.loadingCloud) return;
    this.loadingCloud = true;

    const { data, error } = await this.supabase
      .from("app_state")
      .select("data")
      .eq("id", CLOUD_STATE_ID)
      .maybeSingle<AppStateRow>();

    this.loadingCloud = false;
    if (error) {
      console.warn("Strike Yard cloud sync is unavailable; using this device only.", error.message);
      return;
    }

    if (data?.data) {
      this.db = this.withMigrations(data.data);
      this.persistLocal(this.db);
      this.emit();
      return;
    }

    await this.saveCloudSnapshot(this.db);
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
        (payload) => {
          const row = payload.new as AppStateRow | null;
          if (!row?.data) return;
          this.db = this.withMigrations(row.data);
          this.persistLocal(this.db);
          this.emit();
        },
      )
      .subscribe();
  }

  private queueCloudSave(db: DB): void {
    if (!this.supabase) return;
    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.cloudSaveTimer = setTimeout(() => {
      void this.saveCloudSnapshot(db);
    }, 120);
  }

  private async saveCloudSnapshot(db: DB): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase.from("app_state").upsert({
      id: CLOUD_STATE_ID,
      data: db,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.warn("Strike Yard cloud sync save failed; changes remain on this device.", error.message);
    }
  }

  private mutate(fn: (db: DB) => void): void {
    const next = structuredClone(this.db);
    fn(next);
    this.db = next;
    this.persistLocal(next);
    this.queueCloudSave(next);
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

  resetDemo(): void {
    this.mutate((db) => Object.assign(db, seedDB()));
  }

  // ---- Orders ----

  placeOrder(tableId: string, lines: Omit<OrderLine, "batch">[]): Order {
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
    };
    this.mutate((db) => db.orders.push(placed));
    return placed;
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
      db.calls.push({ id: uid(), tableId, createdAt: Date.now(), resolvedAt: null, resolvedBy: null });
    });
  }

  resolveCall(callId: string, byUserId: string): void {
    this.mutate((db) => {
      const c = db.calls.find((x) => x.id === callId);
      if (c) {
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
