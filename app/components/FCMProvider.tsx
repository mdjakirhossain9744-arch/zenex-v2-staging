"use client";

import { useEffect } from "react";
import { generateFCMToken, setupOnMessage } from "../lib/firebase"; 
import { toast } from "react-hot-toast";

export default function FCMProvider() {
  
  useEffect(() => {
    const setupFCM = async () => {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          
          const storedUser = localStorage.getItem("user");
          if (!storedUser) return; 

          const parsedUser = JSON.parse(storedUser);
          const userEmail = parsedUser.email;
          if (!userEmail) return;

          // ব্রাউজারে Block করা থাকলে চুপচাপ ফিরে যাবে
          if (Notification.permission === "denied") {
              return; 
          }

          const fcmSetupDone = localStorage.getItem("fcm_setup_done");

          // 💥 FIX: জীবনে মাত্র একবার পপ-আপ দেখানোর লজিক 💥
          if (!fcmSetupDone) {
             // পারমিশন চাওয়ার আগেই মেমোরিতে সেভ করে দিলাম। 
             // এখন ইউজার যদি ✕ করেও কেটে দেয়, জীবনেও আর এই পপ-আপ আসবে না!
             localStorage.setItem("fcm_setup_done", "true");

             // এবার পপ-আপ শো করবে
             const permission = await Notification.requestPermission();
             
             // ইউজার যদি Allow করে, শুধুমাত্র তখনই টোকেন বানিয়ে ডাটাবেসে পাঠাবে
             if (permission === "granted") {
                 const token = await generateFCMToken();
                 if (token) {
                   await fetch("/api/user/save-fcm", {
                     method: "POST", headers: { "Content-Type": "application/json" },
                     body: JSON.stringify({ email: userEmail, fcmToken: token }),
                   });
                 }
             }
          }

          // 💥 শুধুমাত্র Allow করা থাকলে নোটিফিকেশন রিসিভ করবে 💥
          if (Notification.permission === "granted") {
             setupOnMessage((payload: any) => {
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