import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCDiFXEFNSRO_uqp0lGh7dwS3Vuh0hfAJI",
  authDomain: "zenex-notification.firebaseapp.com",
  projectId: "zenex-notification",
  storageBucket: "zenex-notification.firebasestorage.app",
  messagingSenderId: "531930832079",
  appId: "1:531930832079:web:4600e6ce948197c2e02bba",
  measurementId: "G-W08WBR2JVG"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 💥 FIX 1: Promise Wrapper - ফায়ারবেস ঘুম থেকে না ওঠা পর্যন্ত অপেক্ষা করবে! 💥
export const getMessagingInstance = async () => {
  if (typeof window === "undefined") return null;
  try {
    const supported = await isSupported();
    if (supported) return getMessaging(app);
    return null;
  } catch (err) {
    return null;
  }
};

export const generateFCMToken = async () => {
  try {
    // 💥 FIX 2: Messaging রেডি হওয়া পর্যন্ত অপেক্ষা করবে 💥
    const msg = await getMessagingInstance();
    if (!msg) return null;

    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      const token = await getToken(msg, {
        vapidKey: "BAcYRYmezszxBlLvihJhwlN2NmXH6kaMG-CUR1-rfrhHa7TiFLVK557bs4vUksUSRJlhfzGy87GzyehHHgx3uUE" 
      });
      return token;
    }
    return null;
  } catch (error) {
    console.error("FCM Token Error:", error);
    return null;
  }
};

// 💥 FIX 3: Dynamic Exporter for onMessage 💥
export const setupOnMessage = async (callback: (payload: any) => void) => {
  const msg = await getMessagingInstance();
  if (msg) {
    onMessage(msg, callback);
  }
};

export { app };