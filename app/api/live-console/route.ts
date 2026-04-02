import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

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

export async function GET(req: NextRequest) {
  try {
    const clientTime = req.nextUrl.searchParams.get('t') || Date.now();
    
    // 💥 ম্যাজিক ১: MNIT এর গ্লোবাল ড্যাশবোর্ডের লিংক এবং অরিজিনাল টোকেন বসানো হলো! 💥
    const mnitUrl = `https://x.mnitnetwork.com/mapi/v1/mdashboard/console/info?_cb=${clientTime}&rnd=${Math.random()}`;

    const response = await fetch(mnitUrl, {
      method: "GET",
      headers: {
        "accept": "application/json, text/plain, */*",
        "mauthtoken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJNX0pZQUlDNDBZQiIsInJvbGUiOiJ1c2VyIiwiYWNjZXNzX3BhdGgiOlsiL2Rhc2hib2FyZCJdLCJleHBpcnkiOjE3NzQ4NjMxNTMsImNyZWF0ZWQiOjE3NzQ3NzY3NTMsIjJvbzkiOiJNc0giLCJleHAiOjE3NzQ4NjMxNTMsImlhdCI6MTc3NDc3Njc1Mywic3ViIjoiTV9KWUFJQzQwWUIifQ.8sBKg2STzGb-oKFgmzib30nD_zVzznFqWD9yrM2AE8U",
        "cookie": "_ga=GA1.1.1498317933.1764484283; mauthtoken=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJNX0pZQUlDNDBZQiIsInJvbGUiOiJ1c2VyIiwiYWNjZXNzX3BhdGgiOlsiL2Rhc2hib2FyZCJdLCJleHBpcnkiOjE3NzQ4NjMxNTMsImNyZWF0ZWQiOjE3NzQ3NzY3NTMsIjJvbzkiOiJNc0giLCJleHAiOjE3NzQ4NjMxNTMsImlhdCI6MTc3NDc3Njc1Mywic3ViIjoiTV9KWUFJQzQwWUIifQ.8sBKg2STzGb-oKFgmzib30nD_zVzznFqWD9yrM2AE8U;",
        "referer": "https://x.mnitnetwork.com/mdashboard/console",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
    let rawOtps: any[] = [];
    
    // গ্লোবাল ডাটা ঠিকমতো বের করা হচ্ছে
    if (result && result.data) {
       if (Array.isArray(result.data)) rawOtps = result.data;
       else if (Array.isArray(result.data.otps)) rawOtps = result.data.otps;
       else if (Array.isArray(result.data.records)) rawOtps = result.data.records;
    } else if (result && Array.isArray(result.otps)) {
       rawOtps = result.otps;
    }

    const formattedLogs = rawOtps.map((item: any) => {
      const num = item.number || item.phone || item.num || "";
      const otpText = item.otp || item.sms || item.msg || item.fullMessage || "";
      
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