"use client";

import { useEffect } from "react";
import { messaging, generateFCMToken, onMessage } from "../lib/firebase"; 
import { toast } from "react-hot-toast";

export default function FCMProvider() {
  
  useEffect(() => {
    const setupFCM = async () => {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          // 💥 ম্যাজিক ফিক্স: PWABuilder-এর বটের জন্য Service Worker সবার আগে চালু করে দেওয়া হলো!
          await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log("✅ Service Worker Registered Successfully!");

          // এবার চেক করবো ইউজার লগইন করা আছে কি না
          const storedUser = localStorage.getItem("user");
          if (!storedUser) return; // লগইন না থাকলে বটের কাজ এখানেই শেষ!

          const parsedUser = JSON.parse(storedUser);
          const userEmail = parsedUser.email;

          if (!userEmail) return;

          // টোকেন জেনারেট করা
          const token = await generateFCMToken();
          
          if (token) {
            console.log("🔥 FCM Token Generated!");
            await fetch("/api/user/save-fcm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: userEmail, fcmToken: token }),
            });
          }

          // লাইভ নোটিফিকেশন লিসেনার
          if (messaging) {
            onMessage(messaging, (payload) => {
              console.log("🔔 New Live Alert: ", payload);

              const audio = new Audio('/notification.mp3');
              audio.play().catch(e => console.log("Audio Play Error:", e));

              toast.success(`${payload.notification?.title}\n${payload.notification?.body}`, {
                duration: 6000,
                position: 'top-right',
                style: { background: '#1E293B', color: '#fff', border: '1px solid #3B82F6', fontWeight: 'bold' }
              });

              window.dispatchEvent(new Event("NEW_LIVE_NOTIFICATION")); 
            });
          }
        } catch (error) {
          console.error("FCM Setup Error:", error);
        }
      }
    };

    setupFCM();
  }, []);

  return null; 
}