"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker in production, checks for updates whenever
 * the app returns to the foreground (visibilitychange / focus), and reloads
 * the page automatically when an updated service worker takes control.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV === "production") {
      // `clients.claim()` also fires `controllerchange` on the very first
      // install. Reloading then would interrupt the visitor's first session
      // for no reason (and used to break long end-to-end journeys); only an
      // actual update replacing an existing controller warrants a reload.
      const hadController = Boolean(navigator.serviceWorker.controller);
      let refreshing = false;
      const handleControllerChange = () => {
        if (hadController && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

      let registrationRef: ServiceWorkerRegistration | null = null;

      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => {
          registrationRef = registration;
          registration.update().catch(() => {});
        })
        .catch((err) => {
          console.warn("Service worker registration failed:", err);
        });

      const checkForSwUpdate = () => {
        if (document.visibilityState === "visible" && registrationRef) {
          registrationRef.update().catch(() => {});
        }
      };

      document.addEventListener("visibilitychange", checkForSwUpdate);
      window.addEventListener("focus", checkForSwUpdate);

      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        document.removeEventListener("visibilitychange", checkForSwUpdate);
        window.removeEventListener("focus", checkForSwUpdate);
      };
    }
  }, []);

  return null;
}
