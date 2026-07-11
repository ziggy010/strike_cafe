export type Diet = "veg" | "nonveg" | "none";
export type Stock = "in" | "low" | "out";
export type OrderStatus = "received" | "preparing" | "ready" | "served" | "cancelled";
export type Role = "admin" | "kitchen" | "waiter" | "counter";
export type Lang = "en" | "ne";

export interface Category {
  id: string;
  name: string;
  nameNe: string;
  sortOrder: number;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  nameNe: string;
  description: string;
  descriptionNe: string;
  price: number; // NPR
  photo: string | null; // data URL or hosted URL
  diet: Diet;
  spice: 0 | 1 | 2 | 3;
  stock: Stock;
  sortOrder: number;
  popular: boolean; // "Popular with players" tag
  special: boolean; // daily special
  prepMin: number; // typical prep time, drives wait estimate
  /** e.g. { from: "07:00", to: "11:00" } for breakfast-only; null = always */
  availableWindow: { from: string; to: string } | null;
}

export interface CafeTable {
  id: string;
  label: string; // "T1", "Court-side 2"
  active: boolean;
}

export interface OrderLine {
  itemId: string;
  name: string; // denormalized at order time so menu edits don't rewrite history
  nameNe: string;
  price: number;
  qty: number;
  note: string;
  batch: number; // round number; batch > 1 = items added to an open order
}

export interface Order {
  id: string;
  code: string; // short human code shown to customer & kitchen, e.g. "K42"
  tableId: string;
  lines: OrderLine[];
  status: OrderStatus;
  batches: number;
  paid: boolean;
  paymentMethod: "cash" | "counter-qr" | null;
  servedBy: string | null; // staff user id who served/closed it
  placedAt: number;
  updatedAt: number;
  statusAt: Partial<Record<OrderStatus, number>>; // timestamps per transition
  feedback: { rating: number; comment: string } | null;
}

export interface WaiterCall {
  id: string;
  tableId: string;
  createdAt: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

export interface StaffUser {
  id: string;
  name: string;
  role: Role;
  pin: string; // 4-digit login PIN (demo mode); replaced by Supabase auth in prod
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string; // "kg", "L", "pcs"
  qty: number;
  lowThreshold: number;
}

export interface InventoryLog {
  id: string;
  inventoryId: string;
  delta: number;
  reason: string;
  by: string;
  at: number;
}

export interface Settings {
  cafeName: string;
  cafeNameNe: string;
  tagline: string;
  phone: string;
  hours: string;
  vatPercent: number; // 0 = prices are inclusive / no VAT line
  serviceChargePercent: number;
  soundOn: boolean; // new-order chime in staff panel
  currency: "NPR";
}

export interface DB {
  version: number;
  categories: Category[];
  items: MenuItem[];
  tables: CafeTable[];
  orders: Order[];
  calls: WaiterCall[];
  staff: StaffUser[];
  inventory: InventoryItem[];
  inventoryLogs: InventoryLog[];
  settings: Settings;
}

export const OPEN_STATUSES: OrderStatus[] = ["received", "preparing", "ready"];

export function isOpen(o: Order): boolean {
  return OPEN_STATUSES.includes(o.status);
}
