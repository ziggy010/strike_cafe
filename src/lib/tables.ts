import type { CafeTable, Order, TableFloor } from "./types";

export const TABLE_FLOORS = [
  { id: "ground", label: "Ground Floor" },
  { id: "upstairs", label: "Upstairs" },
] as const;

export function floorLabel(floor: TableFloor | undefined): string {
  return floor === "upstairs" ? "Upstairs" : "Ground Floor";
}

export function tableDisplay(table: CafeTable): string {
  return `${floorLabel(table.floor)} / ${table.label}`;
}

export function isUnpaidServed(order: Order): boolean {
  return order.status === "served" && !order.paid;
}

export function tableMenuPath(id: string): string {
  return `/t/?table=${encodeURIComponent(id)}`;
}
