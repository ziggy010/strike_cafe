"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Lang } from "./types";

const LS_LANG = "strike-yard-lang";

// Language lives in a tiny module-level store so every component that calls
// useLang re-renders together when the toggle flips.
let currentLang: Lang | null = null;
const langListeners = new Set<() => void>();

function readLang(): Lang {
  if (currentLang === null) {
    try {
      const saved = window.localStorage.getItem(LS_LANG);
      currentLang = saved === "ne" ? "ne" : "en";
    } catch {
      currentLang = "en";
    }
  }
  return currentLang;
}

function writeLang(l: Lang): void {
  currentLang = l;
  try {
    window.localStorage.setItem(LS_LANG, l);
  } catch {}
  langListeners.forEach((fn) => fn());
}

function subscribeLang(fn: () => void): () => void {
  langListeners.add(fn);
  return () => langListeners.delete(fn);
}

const dict = {
  menu: { en: "Menu", ne: "मेनु" },
  all: { en: "All", ne: "सबै" },
  popular: { en: "Player favourites", ne: "खेलाडीको रोजाइ" },
  special: { en: "Today's special", ne: "आजको विशेष" },
  table: { en: "Table", ne: "टेबल" },
  addToOrder: { en: "Add", ne: "थप्नुहोस्" },
  outOfStock: { en: "Sold out", ne: "सकियो" },
  lowStock: { en: "Few left", ne: "थोरै बाँकी" },
  veg: { en: "Veg", ne: "शाकाहारी" },
  nonveg: { en: "Non-veg", ne: "मांसाहारी" },
  spice: { en: "Spice", ne: "पिरो" },
  notePlaceholder: { en: "e.g. less sugar, no onion…", ne: "जस्तै: कम चिनी, प्याज नहाल्ने…" },
  noteLabel: { en: "Note for the kitchen", ne: "भान्साका लागि नोट" },
  viewOrder: { en: "View order", ne: "अर्डर हेर्नुहोस्" },
  yourOrder: { en: "Your order", ne: "तपाईंको अर्डर" },
  placeOrder: { en: "Send to kitchen", ne: "भान्सामा पठाउनुहोस्" },
  addMore: { en: "Add more items", ne: "थप अर्डर गर्नुहोस्" },
  total: { en: "Total", ne: "जम्मा" },
  vat: { en: "VAT", ne: "भ्याट" },
  serviceCharge: { en: "Service charge", ne: "सेवा शुल्क" },
  subtotal: { en: "Subtotal", ne: "उप-जम्मा" },
  emptyCart: { en: "Nothing here yet", ne: "अहिलेसम्म केही छैन" },
  emptyCartHint: { en: "Browse the menu and add something tasty.", ne: "मेनु हेरेर मनपर्ने कुरा थप्नुहोस्।" },
  orderPlaced: { en: "Order sent to kitchen", ne: "अर्डर भान्सामा पुग्यो" },
  orderCode: { en: "Order", ne: "अर्डर" },
  estWait: { en: "Estimated wait", ne: "अनुमानित समय" },
  minutes: { en: "min", ne: "मिनेट" },
  statusReceived: { en: "Received", ne: "प्राप्त भयो" },
  statusPreparing: { en: "Preparing", ne: "पकाउँदै" },
  statusReady: { en: "Ready", ne: "तयार छ" },
  statusServed: { en: "Served", ne: "पुर्‍याइयो" },
  statusCancelled: { en: "Cancelled", ne: "रद्द भयो" },
  callWaiter: { en: "Call waiter", ne: "वेटर बोलाउनुहोस्" },
  waiterComing: { en: "Waiter is on the way", ne: "वेटर आउँदै हुनुहुन्छ" },
  payAtCounter: { en: "Pay by cash or scan the counter QR when you're done.", ne: "खाइसकेपछि नगद वा काउन्टर QR बाट तिर्नुहोस्।" },
  rateOrder: { en: "How was everything?", ne: "खाना कस्तो लाग्यो?" },
  rateThanks: { en: "Thanks for the feedback!", ne: "प्रतिक्रियाको लागि धन्यवाद!" },
  feedbackPlaceholder: { en: "Anything we can do better?", ne: "हामीले के सुधार्न सक्छौं?" },
  send: { en: "Send", ne: "पठाउनुहोस्" },
  cancel: { en: "Cancel", ne: "रद्द" },
  scanHint: { en: "Scan the QR code on your table to start ordering.", ne: "अर्डर गर्न टेबलको QR कोड स्क्यान गर्नुहोस्।" },
  breakfastOnly: { en: "Breakfast hours only", ne: "बिहानको समयमा मात्र" },
  qty: { en: "Qty", ne: "संख्या" },
  items: { en: "items", ne: "वटा" },
  yourNote: { en: "Your note", ne: "तपाईंको नोट" },
  newRound: { en: "New items added", ne: "नयाँ अर्डर थपियो" },
  closedOrder: { en: "This order is complete.", ne: "यो अर्डर सकियो।" },
  startNew: { en: "Start a new order", ne: "नयाँ अर्डर सुरु गर्नुहोस्" },
} as const;

export type TKey = keyof typeof dict;

export function useLang(): { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string } {
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "en" as Lang);
  const t = useCallback((k: TKey) => dict[k][lang], [lang]);
  return { lang, setLang: writeLang, t };
}

/** Pick the localized field from a bilingual record, falling back to English. */
export function loc(lang: Lang, en: string, ne: string): string {
  return lang === "ne" && ne.trim() ? ne : en;
}
