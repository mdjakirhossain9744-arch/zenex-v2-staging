import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 💥 Anti-Spam Firewall (Rate Limiter) 💥
const ipMap = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 5000; 
const MAX_REQUESTS = 15; 

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown_ip";
    const now = Date.now();
    const ipData = ipMap.get(ip) || { count: 0, startTime: now };

    if (now - ipData.startTime > RATE_LIMIT_WINDOW) {
      ipData.count = 1;
      ipData.startTime = now;
    } else {
      ipData.count++;
      if (ipData.count > MAX_REQUESTS) {
        return NextResponse.json({ success: false, error: "SPAM DETECTED: You have been temporarily blocked." }, { status: 429 });
      }
    }
    ipMap.set(ip, ipData);

    const API_KEY = "M_7VX25KAJI"; 

    // 💥 THE MASTER BRIDGE: Fetching from our own Fastify instead of MNIT 💥
    // এতে MNIT ব্লক করবে না, আর Console-এ রকেটের গতিতে ডাটা শো করবে!
    const response = await fetch(`http://127.0.0.1:4000/v1/numsuccess/info`, {
      method: "GET",
      headers: { "mapikey": API_KEY },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: "Internal Fastify Engine Blocked Request" }, { status: 400 });
    }

    const data = await response.json();

    if (data.meta?.status === "success") {
      const otpArray = Array.isArray(data.data) ? data.data : (data.data?.otps || []);
      return NextResponse.json({ success: true, otps: otpArray }, { status: 200 });
    } else {
      return NextResponse.json({ success: false, error: data.message || "Failed to fetch OTPs" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Network Error or Fastify Timeout" }, { status: 500 });
  }
}