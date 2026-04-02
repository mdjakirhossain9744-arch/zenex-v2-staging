import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 💥 আপনার দেওয়া আসল MNIT API Key 💥
const MNIT_API_KEY = "M_7VX25KAJI";

let cachedData: any = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5000; // ৫ সেকেন্ড ক্যাশ

export async function GET() {
  try {
    const currentTime = Date.now();

    if (cachedData && (currentTime - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json(cachedData);
    }

    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info", {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        // 💥 Cloudflare 403 Bypass (Dalvik Android User-Agent) 💥
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)",
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive"
      },
      cache: "no-store",
    });

    if (response.status === 429) {
       if (cachedData) return NextResponse.json(cachedData);
       return NextResponse.json({ success: false, error: "Too many requests. Retrying..." }, { status: 429 });
    }

    if (response.status === 401) {
       return NextResponse.json({ success: false, error: "Invalid MNIT API Key! Access Denied." }, { status: 401 });
    }

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Provider API Error: ${response.status}` }, { status: response.status });
    }

    const result = await response.json();
    
    if (result && result.data && Array.isArray(result.data.otps)) {
       const formattedLogs = result.data.otps.map((item: any) => ({
          number: item.number,
          otp: item.otp,
          country: item.country,
          operator: item.operator,
          time: item.created_at
       }));

       cachedData = { success: true, data: formattedLogs };
       lastFetchTime = currentTime;

       return NextResponse.json(cachedData);
    }

    return NextResponse.json({ success: false, error: "No OTP data found in provider response" });

  } catch (error: any) {
    console.error("Live Console API Error:", error.message);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ success: false, error: "Network Error or Blocked by Provider" }, { status: 500 });
  }
}