import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 💥 মেমরি ক্যাশ ভেরিয়েবল (অরিজিনাল সাইটকে 429 Rate Limit থেকে বাঁচানোর জন্য) 💥
let cachedData: any = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 12000; // ১২ সেকেন্ডের জন্য ডাটা ক্যাশ করে রাখবে

export async function GET() {
  try {
    const currentTime = Date.now();

    // যদি ১২ সেকেন্ড পার না হয়, তবে আগের সেভ করা ডাটা দিয়ে দিবে (নতুন রিকোয়েস্ট করবে না)
    if (cachedData && (currentTime - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json(cachedData);
    }

    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/mdashboard/console/info", {
      method: "GET",
      headers: {
        "accept": "application/json, text/plain, */*",
        "accept-encoding": "gzip, deflate, br",
        "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
        "mauthtoken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJNX0pZQUlDNDBZQiIsInJvbGUiOiJ1c2VyIiwiYWNjZXNzX3BhdGgiOlsiL2Rhc2hib2FyZCJdLCJleHBpcnkiOjE3NzQ4NjMxNTMsImNyZWF0ZWQiOjE3NzQ3NzY3NTMsIjJvbzkiOiJNc0giLCJleHAiOjE3NzQ4NjMxNTMsImlhdCI6MTc3NDc3Njc1Mywic3ViIjoiTV9KWUFJQzQwWUIifQ.8sBKg2STzGb-oKFgmzib30nD_zVzznFqWD9yrM2AE8U",
        "cookie": "_ga=GA1.1.1498317933.1764484283; _ga_DTBL962NC5=GS2.1.s1768629372$o73$g0$t1768629372$j60$l0$h0; mauthtoken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJNX0pZQUlDNDBZQiIsInJvbGUiOiJ1c2VyIiwiYWNjZXNzX3BhdGgiOlsiL2Rhc2hib2FyZCJdLCJleHBpcnkiOjE3NzQ4NjMxNTMsImNyZWF0ZWQiOjE3NzQ3NzY3NTMsIjJvbzkiOiJNc0giLCJleHAiOjE3NzQ4NjMxNTMsImlhdCI6MTc3NDc3Njc1Mywic3ViIjoiTV9KWUFJQzQwWUIifQ.8sBKg2STzGb-oKFgmzib30nD_zVzznFqWD9yrM2AE8U; cf_clearance=nd9BjCrmqHI41NZXLplhD7jU7_NjZwlzmHJq_hgKRKM-1774811837-1.2.1.1-0.J3iEQZrMNpUIW_7jTRm0MG5jNM41nX7L4aeI4.WSrT2S3p_0XqOqPD3pqr2I.x3LiEellwIvrW201baS50qF.stx5WntA2sWc2ZMbo_QeymZVyU35vblc5Fjp2ywc9DRextSNIQE1xALJIQ2O3cuXs2aISpF1p0Q0Ue791bbfRa5UkkX_sivaLAWRV47VccoQsyzQDZiqNY.tF7eQdgHRtqzK9hu75w7_pJNzYHsI; TawkConnectionTime=0; twk_uuid_681787a55d55ef191a9da720=%7B%22uuid%22%3A%221.Ws4Z5089Tc9BNPLxfqlSaWKTk7VqG4tVHdA5rW9BZkb3RZTfxGP0IEuAmXdmkOjjuWiXgagAj2OAQdjB9zRAmI3LOc7i5eAiC3CmoE30x7JaKK4I42bwnOgDk%22%2C%22version%22%3A3%2C%22domain%22%3A%22mnitnetwork.com%22%2C%22ts%22%3A1774812097227%7D",
        "referer": "https://x.mnitnetwork.com/mdashboard/console",
        "sec-ch-ua": '"Chromium";v="137", "Not/A)Brand";v="24"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"
      },
      cache: "no-store",
    });

    // যদি 429 ব্লক খায় কিন্তু আমাদের কাছে পুরনো ক্যাশ ডাটা থাকে, তবে সেটা দিয়ে সার্ভার ক্র্যাশ হওয়া থেকে বাঁচাবো
    if (response.status === 429) {
       if (cachedData) {
         return NextResponse.json(cachedData);
       }
       return NextResponse.json({ success: false, error: "Too many requests to provider. Retrying..." }, { status: 429 });
    }

    if (!response.ok) {
      return NextResponse.json({ success: false, error: `Provider API Error: ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    
    // নতুন ডাটা ক্যাশে সেভ করা হচ্ছে
    cachedData = data;
    lastFetchTime = currentTime;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Live Console API Error:", error);
    // সার্ভার ডাউন হলেও পুরনো ডাটা দেখাবে
    if (cachedData) return NextResponse.json(cachedData);
    
    return NextResponse.json({ success: false, error: "Network Error or Blocked by Cloudflare" }, { status: 500 });
  }
}