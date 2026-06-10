"use client";

import { useEffect } from "react";
import { messaging, generateFCMToken, onMessage } from "../lib/firebase"; 
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

          // 💥 ম্যাজিক ফিক্স: বারবার বিরক্ত করা বন্ধ! 💥
          const fcmSetupDone = localStorage.getItem("fcm_setup_done");
          
          if (!fcmSetupDone) {
             const token = await generateFCMToken();
             if (token) {
               await fetch("/api/user/save-fcm", {
                 method: "POST", headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ email: userEmail, fcmToken: token }),
               });
               // একবার সেভ হলে ব্রাউজারে মার্ক করে রাখবো
               localStorage.setItem("fcm_setup_done", "true");
             }
          }

          if (messaging) {
            onMessage(messaging, (payload) => {
              const audio = new Audio('/notification.mp3');
              audio.play().catch(e => console.log(e));

              toast.success(`${payload.notification?.title}\n${payload.notification?.body}`, {
                duration: 6000, position: 'top-right',
                style: { background: '#1E293B', color: '#fff', border: '1px solid #3B82F6', fontWeight: 'bold' }
              });

              window.dispatchEvent(new Event("NEW_LIVE_NOTIFICATION")); 
            });
          }
        } catch (error) {}
      }
    };
    setupFCM();
  }, []);

  return null; 
}