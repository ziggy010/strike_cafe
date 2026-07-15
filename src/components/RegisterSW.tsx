"use client";

import { useEffect } from "react";
import { assetPath } from "@/lib/assets";

/**
 * Registers the service worker (production only, so dev never serves stale
 * cached assets). Scope follows the deploy base path via assetPath, so it
 * works at "/" locally and "/strike_cafe/" on GitHub Pages.
 */
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register(assetPath("/sw.js"), { scope: assetPath("/") || "/" })
        .catch((err) => console.warn("Strike Yard service worker registration failed.", err));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
