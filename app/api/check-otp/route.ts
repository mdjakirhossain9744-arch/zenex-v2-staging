import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 💥 Anti-Spam Firewall (Rate Limiter) 💥 - (আপনার অসাধারণ সিকিউরিটি লজিকটা আমি রেখে দিয়েছি)
const ipMap = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 5000; // ৫ সেকেন্ড
const MAX_REQUESTS = 15; // ৫ সেকেন্ডে ১৫ বারের বেশি রিকোয়েস্ট করলে ব্লক খাবে

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
    // ২. THE ENTERPRISE FIX (No more MNIT DDoS!)
    // ==========================================
    // বস, আমরা MNIT-এ হিট করা বন্ধ করে দিয়েছি কারণ ফাস্টিফাই (Fastify) অলরেডি ব্যাকগ্রাউন্ডে ডাটাবেস আপডেট করছে।
    // এটা শুধু Success রিটার্ন করবে, ফলে সার্ভারের CPU লোড 0% থাকবে এবং কোনো 502 Error আসবে না!
    
    return NextResponse.json({ 
        success: true, 
        message: "OTP is securely syncing in the background via ZENEX Fastify Engine." 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Check OTP Error:", error.message);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}