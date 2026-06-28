"use client";

import { useEffect } from "react";
import { messaging, generateFCMToken, onMessage } from "../lib/firebase"; 
import { toast } from "react-hot-toast";

export default function FCMProvider() {
  
  useEffect(() => {
    const setupFCM = async () => {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          // Service Worker Registration
          await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          
          const storedUser = localStorage.getItem("user");
          if (!storedUser) return; 

          const parsedUser = JSON.parse(storedUser);
          const userEmail = parsedUser.email;
          if (!userEmail) return;

          // 💥 FIX 1: যদি ইউজার Block করে দেয়, জীবনেও আর বিরক্ত করবে না 💥
          if (Notification.permission === "denied") {
              return; 
          }

          const fcmSetupDone = localStorage.getItem("fcm_setup_done");
          const fcmAskedTime = localStorage.getItem("fcm_asked_time");

          if (!fcmSetupDone) {
             // 💥 FIX 2: 24-Hour Cooldown (ইউজার ✕ করে কেটে দিলে ২৪ ঘণ্টা আর পপ-আপ আসবে না) 💥
             if (fcmAskedTime && (Date.now() - parseInt(fcmAskedTime)) < 24 * 60 * 60 * 1000) {
                 return; 
             }
             
             // মার্ক করে রাখা হলো যে আমরা এখন তাকে জিজ্ঞেস করছি
             localStorage.setItem("fcm_asked_time", Date.now().toString());

             // পারমিশন চাওয়া হলো
             const permission = await Notification.requestPermission();
             
             if (permission === "granted") {
                 const token = await generateFCMToken();
                 if (token) {
                   await fetch("/api/user/save-fcm", {
                     method: "POST", headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ email: userEmail, fcmToken: token }),
                   });
                   // সাকসেস! আর কখনোই তাকে পপ-আপ দেখাবে না।
                   localStorage.setItem("fcm_setup_done", "true");
                 }
             }
          }

          // 💥 FIX 3: শুধুমাত্র পারমিশন Allow থাকলেই নোটিফিকেশন রিসিভ করবে 💥
          if (Notification.permission === "granted" && messaging) {
            onMessage(messaging, (payload) => {
              const audio = new Audio('/notification.mp3');
              // ব্রাউজার অডিও ব্লক করলে যেন সাইট হ্যাং না হয়
              audio.play().catch(e => console.log("Audio auto-play blocked by browser"));

              toast.success(`${payload.notification?.title}\n${payload.notification?.body}`, {
                duration: 6000, position: 'top-right',
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