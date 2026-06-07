"use client";

import { useEffect } from "react";
import { messaging, generateFCMToken, onMessage } from "../lib/firebase"; 
import { toast } from "react-hot-toast";

export default function FCMProvider() {
  
  useEffect(() => {
    const setupFCM = async () => {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          const storedUser = localStorage.getItem("user");
          if (!storedUser) return; 

          const parsedUser = JSON.parse(storedUser);
          const userEmail = parsedUser.email;

          if (!userEmail) return;

          const token = await generateFCMToken();
          
          if (token) {
            console.log("🔥 FCM Token Generated!");
            await fetch("/api/user/save-fcm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: userEmail, fcmToken: token }),
            });
            console.log("✅ Token Saved to Database for:", userEmail);
          }

          if (messaging) {
            onMessage(messaging, (payload) => {
              console.log("🔔 New Live Alert: ", payload);

              // ১. সাউন্ড বাজানো
              const audio = new Audio('/notification.mp3');
              audio.play().catch(e => console.log("Audio Play Error:", e));

              // ২. পপআপ দেখানো
              toast.success(`${payload.notification?.title}\n${payload.notification?.body}`, {
                duration: 6000,
                position: 'top-right',
                style: {
                  background: '#1E293B',
                  color: '#fff',
                  border: '1px solid #3B82F6',
                  fontWeight: 'bold'
                }
              });

              // 💥 ৩. ম্যাজিক: পুরো ওয়েবসাইটকে লাইভ রিফ্রেশ হওয়ার সিগন্যাল দেওয়া! 💥
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