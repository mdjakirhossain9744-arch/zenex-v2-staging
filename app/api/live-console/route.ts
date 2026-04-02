import { NextResponse } from "next/server";

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

export async function GET() {
  try {
    // 💥 কোনো MongoDB নেই! সরাসরি MNIT থেকে ফ্রেশ ডাটা আনা হচ্ছে 💥
    const mnitUrl = `https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${Date.now()}`;

    const response = await fetch(mnitUrl, {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; Android 12)",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
      next: { revalidate: 0 } // ক্যাশ কিল সুইচ
    });

    if (!response.ok) {
       return NextResponse.json({ success: false, error: `MNIT Blocked: ${response.status}` }, { status: response.status });
    }

    const result = await response.json();
    const otps = result?.data?.otps || [];

    // ১. ডাটাবেস ছাড়াই সরাসরি লিস্ট তৈরি (ফ্রন্টএন্ডের জন্য রেডি করা)
    const formattedLogs = otps.map((item: any) => ({
      id: item.nid || Math.random().toString(),
      number: item.number,
      otp: item.otp,
      country: item.country || "GLOBAL",
      operator: item.operator || "Other",
      service: getServiceName(item.otp),
      // MNIT এর পাঠানো টাইম, না থাকলে আমাদের সার্ভারের বর্তমান টাইম
      createdAt: item.created_at ? new Date(item.created_at) : new Date() 
    }));

    // ২. ডাটাবেস ছাড়াই সরাসরি গ্রাফের হিসাব
    const counts: Record<string, number> = {};
    formattedLogs.forEach((log: any) => {
      counts[log.service] = (counts[log.service] || 0) + 1;
    });

    let graphData = Object.keys(counts)
      .map(key => ({ name: key, value: counts[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); // সেরা ৮টি অ্যাপ

    // ৩. গ্রাফে মিনিমাম ৮টা বার দেখানোর জন্য ফাঁকা প্যাডিং (যেটা আগেরবার কেটে গিয়েছিল)
    let pad = " ";
    while (graphData.length < 8) {
      graphData.push({ name: pad, value: 0 });
      pad += " ";
    }

    // সরাসরি ফ্রন্টএন্ডে পাঠিয়ে দেওয়া হচ্ছে
    return NextResponse.json({ 
      success: true, 
      logs: formattedLogs, 
      graph: graphData 
    });

  } catch (error: any) {
    console.error("Direct Proxy Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}