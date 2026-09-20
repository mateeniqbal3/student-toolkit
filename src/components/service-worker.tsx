"use client";

import { useEffect } from "react";

/**
 * Registers the service worker after the page has settled, so it never
 * competes with first paint on a slow connection.
 *
 * Skipped in development, where a stale worker caching the dev bundle causes
 * confusing behaviour.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Service worker registration failed", error);
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
