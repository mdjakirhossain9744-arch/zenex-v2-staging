import { NextRequest, NextResponse } from "next/server"; // 🔥 NextRequest যোগ করা হয়েছে

// 💥 Vercel এর ক্যাশিং চিরতরে অফ করার কমান্ড 💥
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const MNIT_API_KEY = "M_7VX25KAJI";

const getServiceName = (message: string) => {
  const msgLower = (message || "").toLowerCase();
  const popularApps = ['facebook', 'whatsapp', 'telegram', 'instagram', 'google', 'tiktok', 'apple', 'amazon', 'netflix', 'yahoo', 'twitter', 'paypal', 'discord', 'tinder', 'uber', 'viber', 'line', 'coinw'];
  
  for (const app of popularApps) {
    if (msgLower.includes(app)) return app.toUpperCase();
  }
  if (msgLower.includes(" fb ")) return "FACEBOOK";
  if (msgLower.includes(" ig ")) return "INSTAGRAM";
  if (msgLower.includes(" wa ")) return "WHATSAPP";
  if (msgLower.includes(" tg ")) return "TELEGRAM";
  return "OTHER";
};

// 🔥 ম্যাজিক: req: NextRequest অ্যাড করা হয়েছে, এতে Vercel জীবনেও ক্যাশ করতে পারবে না!
export async function GET(req: NextRequest) {
  try {
    // ফ্রন্টএন্ড থেকে পাঠানো রিয়েল-টাইম মিলি-সেকেন্ড ধরা হচ্ছে
    const clientTime = req.nextUrl.searchParams.get('t') || Date.now();
    
    // 💥 MNIT-কে বাধ্য করা হচ্ছে প্রতিবার ফ্রেশ ডাটা দিতে (ডাবল ক্যাশ বাস্টার)
    const mnitUrl = `https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?_cb=${clientTime}&rnd=${Math.random()}`;

    const response = await fetch(mnitUrl, {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; Android 12)",
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    });

    if (!response.ok) {
       return NextResponse.json({ success: false, error: `MNIT Blocked: ${response.status}` }, { status: response.status });
    }

    const result = await response.json();
    const otps = result?.data?.otps || [];

    const formattedLogs = otps.map((item: any) => ({
      id: item.nid || Math.random().toString(),
      number: item.number,
      otp: item.otp,
      country: item.country || "GLOBAL",
      operator: item.operator || "Other",
      service: getServiceName(item.otp),
      createdAt: item.created_at ? new Date(item.created_at) : new Date() 
    }));

    const counts: Record<string, number> = {};
    formattedLogs.forEach((log: any) => {
      counts[log.service] = (counts[log.service] || 0) + 1;
    });

    let graphData = Object.keys(counts)
      .map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); 

    let pad = " ";
    while (graphData.length < 8) {
      graphData.push({ name: pad, value: 0 });
      pad += " ";
    }

    // রেসপন্সে রেন্ডম আইডি পাঠানো হচ্ছে যাতে ব্রাউজারও ক্যাশ না করে
    return NextResponse.json({ 
      success: true, 
      logs: formattedLogs, 
      graph: graphData,
      _timestamp: Date.now() 
    });

  } catch (error: any) {
    console.error("Direct Proxy Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}