"use client";

import { useEffect } from "react";

export default function SessionWatcher() {
  useEffect(() => {
    const syncSession = (e: StorageEvent) => {
      // যদি অন্য ট্যাবে লগইন বা লগআউট হয়, তবে এই ট্যাবটি সাথে সাথে রিলোড হবে
      if (e.key === "zenex_session_sync") {
        window.location.reload(); 
      }
    };

    window.addEventListener("storage", syncSession);
    return () => window.removeEventListener("storage", syncSession);
  }, []);

  return null; 
}