import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 💥 Anti-Spam Firewall (Rate Limiter) 💥
const ipMap = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 5000; // ৫ সেকেন্ড
const MAX_REQUESTS = 15; // ৫ সেকেন্ডে ১৫ বারের বেশি রিকোয়েস্ট করলে ব্লক খাবে

// 💥 Memory Cache (সার্ভার এবং ডাটাবেস ডাউন হওয়া থেকে বাঁচানোর জন্য) 💥
let cachedData: any = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 3000; // ৩ সেকেন্ডের জন্য ডাটা মেমরিতে সেভ থাকবে

export async function GET(req: Request) {
  try {
    // ==========================================
    // ১. IP Rate Limiting Logic (Spam Detection)
    // ==========================================
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown_ip";
    const now = Date.now();
    const ipData = ipMap.get(ip) || { count: 0, startTime: now };

    if (now - ipData.startTime > RATE_LIMIT_WINDOW) {
      ipData.count = 1;
      ipData.startTime = now;
    } else {
      ipData.count++;
      if (ipData.count > MAX_REQUESTS) {
        console.warn(`🚨 SPAM FIREWALL BLOCKED IP: ${ip} (Too many requests)`);
        return NextResponse.json({ 
          success: false, 
          error: "SPAM DETECTED: You have been temporarily blocked by firewall." 
        }, { status: 429 });
      }
    }
    ipMap.set(ip, ipData);

    // ==========================================
    // ২. Memory Cache Logic
    // ==========================================
    if (cachedData && (now - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json(cachedData, { status: 200 });
    }

    // ==========================================
    // ৩. Original API Fetch Logic (WITH BYPASS)
    // ==========================================
    const API_KEY = "M_7VX25KAJI"; 

    // 💥 Cloudflare / WAF Bypass (Android Mobile App Dalvik Trick) 💥
    const response = await fetch(`https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${Date.now()}`, {
      method: "GET",
      headers: {
        "mapikey": API_KEY,
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", // 💥 ম্যাজিক হেডার: Cloudflare একে মোবাইল অ্যাপ মনে করবে 💥
        "Accept": "application/json",
        "Connection": "keep-alive",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OTP API Blocked by Provider:", errText);
      // যদি প্রোভাইডার ব্লক করে, তবে পুরনো সেভ করা ক্যাশ ডাটা পাঠাবে যেন সাইট ক্র্যাশ না করে
      if (cachedData) return NextResponse.json(cachedData, { status: 200 });
      return NextResponse.json({ success: false, error: "Provider Blocked Request" }, { status: 400 });
    }

    const data = await response.json();

    if (data.meta?.status === "success") {
      // 💥 API থেকে আসা ডাটা Array হিসেবে আছে কি না তা নিশ্চিত করা হচ্ছে
      const otpArray = Array.isArray(data.data) ? data.data : (data.data?.otps || []);
      
      // নতুন ডাটা ক্যাশে সেভ করা হচ্ছে
      cachedData = { success: true, otps: otpArray };
      lastFetchTime = now;
      return NextResponse.json(cachedData, { status: 200 });
    } else {
      return NextResponse.json({ success: false, error: data.message || "Failed to fetch OTPs" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("OTP Fetch Error:", error.message);
    // যদি অরিজিনাল সাইট ডাউনও থাকে, আমাদের সেভ করা ক্যাশ ডাটা শো করবে
    if (cachedData) return NextResponse.json(cachedData, { status: 200 });
    
    return NextResponse.json({ success: false, error: "Network Error or API Timeout" }, { status: 500 });
  }
}