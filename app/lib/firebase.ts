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

let messaging: any = null;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) messaging = getMessaging(app);
  });
}

export const generateFCMToken = async () => {
  try {
    if (!messaging) return null;
    const permission = await Notification.requestPermission();
    
    if (permission === "granted") {
      const token = await getToken(messaging, {
        // ফায়ারবেস কনসোল থেকে VAPID Key এনে পরে এখানে বসাবো
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

export { app, messaging, onMessage };