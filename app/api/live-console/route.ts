import { NextRequest, NextResponse } from "next/server";

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

// 🔥 NextRequest ব্যবহার করা হয়েছে, তাই Vercel ক্যাশ করতে পারবে না (১৭টা ওটিপি আর আটকে থাকবে না)
export async function GET(req: NextRequest) {
  try {
    const clientTime = req.nextUrl.searchParams.get('t') || Date.now();
    
    // 💥 অফিশিয়াল পাবলিক এপিআই: এটা কুকি এক্সপায়ারের ঝামেলা ছাড়াই লাইভ গ্লোবাল ডাটা দেয় 💥
    const mnitUrl = `https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?_cb=${clientTime}&rnd=${Math.random()}`;

    const response = await fetch(mnitUrl, {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12)",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    });

    if (!response.ok) {
       return NextResponse.json({ success: false, error: `MNIT Blocked: ${response.status}` }, { status: response.status });
    }

    const result = await response.json();
    const rawOtps = result?.data?.otps || [];

    const formattedLogs = rawOtps.map((item: any) => {
      const num = item.number || item.phone || "";
      const otpText = item.otp || item.sms || "";
      
      return {
        id: item.nid || item.id || `${num}_${Math.random()}`,
        number: num,
        otp: otpText,
        country: item.country || item.iso || "GLOBAL",
        operator: item.operator || item.carrier || "Other",
        service: getServiceName(otpText),
        createdAt: item.created_at ? new Date(item.created_at) : new Date() 
      };
    });

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

    return NextResponse.json({ 
      success: true, 
      logs: formattedLogs, 
      graph: graphData,
      _timestamp: Date.now()
    });

  } catch (error: any) {
    console.error("Live Console Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}