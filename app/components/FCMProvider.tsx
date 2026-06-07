"use client";

import { useEffect } from "react";
import { messaging, generateFCMToken, onMessage } from "../lib/firebase"; // পাথ লাল দেখালে "../lib/firebase" বা "@/lib/firebase" দিন
import { toast } from "react-hot-toast";

export default function FCMProvider() {
  
  useEffect(() => {
    const setupFCM = async () => {
      // ব্রাউজার সাপোর্ট করে কি না চেক করা
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        try {
          // ১. LocalStorage থেকে লগইন করা ইউজারের ইমেইল বের করা
          const storedUser = localStorage.getItem("user");
          if (!storedUser) return; // ইউজার লগইন না থাকলে টোকেন বানানোর দরকার নেই

          const parsedUser = JSON.parse(storedUser);
          const userEmail = parsedUser.email;

          if (!userEmail) return;

          // ২. ব্রাউজার থেকে পারমিশন নিয়ে টোকেন জেনারেট করা
          const token = await generateFCMToken();
          
          if (token) {
            console.log("🔥 FCM Token Generated!");
            
            // ৩. API-তে হিট করে টোকেনটা ডেটাবেসে সেভ করা (ম্যাজিক পার্ট ✨)
            await fetch("/api/user/save-fcm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: userEmail, fcmToken: token }),
            });
            console.log("✅ Token Saved to Database for:", userEmail);
          }

          // ৪. ওয়েবসাইটে থাকা অবস্থায় লাইভ নোটিফিকেশন রিসিভ করা (সাউন্ড + পপআপ)
          if (messaging) {
            onMessage(messaging, (payload) => {
              console.log("🔔 New Live Alert: ", payload);

              // সাউন্ড বাজানো (public ফোল্ডারে notification.mp3 নামের ফাইলটি থাকতে হবে)
              const audio = new Audio('/notification.mp3');
              audio.play().catch(e => console.log("Audio Play Error:", e));

              // সুন্দর পপআপ (Toast) দেখানো
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
            });
          }
        } catch (error) {
          console.error("FCM Setup Error:", error);
        }
      }
    };

    setupFCM();
  }, []);

  return null; // এটি ব্যাকগ্রাউন্ডে কাজ করবে, তাই UI-তে কিছু দেখাবে না
}