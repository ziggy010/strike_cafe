"use client";

import { useSyncExternalStore } from "react";
import type { DB } from "./types";
import { getServerSnapshot, getStore } from "./store";

/** Live view of the whole database; re-renders on any change (local or other tabs). */
export function useDB(): DB {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
}

/**
 * True once we're hydrated on the client — used to gate content that differs
 * from the server-rendered seed snapshot (orders, cart, etc.).
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// Hydration-safe web-storage strings without setState-in-effect: reads go
// through useSyncExternalStore (server snapshot = null), writes notify all
// subscribers of that key in this tab.
const storageListeners = new Map<string, Set<() => void>>();

function notifyKey(key: string): void {
  storageListeners.get(key)?.forEach((fn) => fn());
}

export function writeStoredString(kind: "local" | "session", key: string, value: string | null): void {
  try {
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    if (value === null) s.removeItem(key);
    else s.setItem(key, value);
  } catch {}
  notifyKey(key);
}

export function useStoredString(kind: "local" | "session", key: string): string | null {
  return useSyncExternalStore(
    (fn) => {
      let set = storageListeners.get(key);
      if (!set) {
        set = new Set();
        storageListeners.set(key, set);
      }
      set.add(fn);
      return () => set.delete(fn);
    },
    () => {
      try {
        const s = kind === "local" ? window.localStorage : window.sessionStorage;
        return s.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}
