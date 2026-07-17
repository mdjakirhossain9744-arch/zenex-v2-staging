"use client";

import { useEffect } from "react";

export default function SessionWatcher() {
  useEffect(() => {
    const syncSession = (e: StorageEvent) => {
      // 💥 THE FIX: Prevent Infinite Reload Loop 💥
      if (e.key === "zenex_session_sync" && e.newValue) {
        const lastReload = sessionStorage.getItem("zenex_last_reload");
        const now = Date.now();
        // Only allow reload if it hasn't reloaded in the last 3 seconds
        if (!lastReload || now - parseInt(lastReload) > 3000) {
          sessionStorage.setItem("zenex_last_reload", now.toString());
          window.location.reload(); 
        }
      }
    };

    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  return null; 
}