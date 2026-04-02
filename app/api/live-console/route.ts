import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 💥 আপনার MNIT API Key এখানে বসান 💥
const MNIT_API_KEY = process.env.MNIT_API_KEY || "YOUR_API_KEY_HERE";

// 💥 মেমরি ক্যাশ ভেরিয়েবল (সাইটকে সুপারফাস্ট রাখার জন্য) 💥
let cachedData: any = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5000; // ১০ সেকেন্ডের জন্য ডাটা ক্যাশ করে রাখবে

export async function GET() {
  try {
    const currentTime = Date.now();

    // যদি ১০ সেকেন্ড পার না হয়, তবে সার্ভারে সেভ করা আগের ডাটা দিয়ে দিবে (MNIT কে বারবার ডিস্টার্ব করবে না)
    if (cachedData && (currentTime - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json(cachedData);
    }

    // 💥 MNIT এর অফিশিয়াল Public API (No fake cookies needed!) 💥
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info", {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json"
      },
      cache: "no-store",
    });

    // যদি MNIT ব্লক করে কিন্তু আমাদের কাছে পুরনো ক্যাশ ডাটা থাকে
    if (response.status === 429) {
       if (cachedData) return NextResponse.json(cachedData);
       return NextResponse.json({ success: false, error: "Too many requests to provider. Retrying..." }, { status: 429 });
    }

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Provider API Error: ${response.status}` }, { status: response.status });
    }

    const result = await response.json();
    
    // ডাটা ঠিকঠাক আসলে সেটাকে আমাদের ফ্রন্টএন্ডের জন্য সুন্দর করে সাজানো
    if (result && result.meta?.status === "success" && result.data?.otps) {
       const formattedLogs = result.data.otps.map((item: any) => ({
          number: item.number,
          otp: item.otp,
          country: item.country,
          operator: item.operator,
          time: item.created_at // ফ্রন্টএন্ডের টাইমের জন্য
       }));

       // নতুন ডাটা ক্যাশে সেভ করা হচ্ছে
       cachedData = { success: true, data: formattedLogs };
       lastFetchTime = currentTime;

       return NextResponse.json(cachedData);
    }

    return NextResponse.json({ success: false, error: "Invalid data format from provider" });

  } catch (error) {
    console.error("Live Console API Error:", error);
    // সার্ভার ডাউন হলেও পুরনো ক্যাশ করা ডাটা দেখাবে
    if (cachedData) return NextResponse.json(cachedData);
    
    return NextResponse.json({ success: false, error: "Network Error or Blocked by Provider" }, { status: 500 });
  }
}