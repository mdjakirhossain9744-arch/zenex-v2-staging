import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import Order from "../../../models/Order"; 

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

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const clientTime = req.nextUrl.searchParams.get('t') || Date.now();
    const twentyMinsAgo = Date.now() - 20 * 60 * 1000; 
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 💥 ১. নিজেদের ডাটা 💥
    const localOrders = await Order.find({
      status: { $in: ["DONE", "Success"] },
      createdAt: { $gte: twentyFourHoursAgo }
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

    const localLogs = localOrders.map((log: any) => ({
      id: log._id.toString(),
      number: log.searchNumber || log.number || "",
      otp: log.fullMessage || log.otp || "",
      country: log.country || "BD",
      operator: log.operator || "Other",
      service: getServiceName(log.fullMessage || log.otp),
      createdAt: new Date(log.createdAt).getTime()
    }));

    // 💥 ২. MNIT Public API (EXACT ORIGINAL HEADERS TO BYPASS CLOUDFLARE) 💥
    let mnitLogs: any[] = [];
    try {
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

      if (response.ok) {
        const result = await response.json();
        
        let rawOtps: any[] = [];
        if (Array.isArray(result)) rawOtps = result;
        else if (Array.isArray(result?.data?.otps)) rawOtps = result.data.otps;
        else if (Array.isArray(result?.data)) rawOtps = result.data;
        else if (Array.isArray(result?.logs)) rawOtps = result.logs;
        else if (Array.isArray(result?.otps)) rawOtps = result.otps;
        
        mnitLogs = rawOtps.map((item: any, index: number) => {
          const num = item.number || item.phone || "Hidden";
          const otpText = item.otp || item.sms || item.message || "Code";
          return {
            id: `mnit_${Date.now()}_${index}`,
            number: num,
            otp: otpText,
            country: item.country || item.iso || "GLOBAL",
            operator: item.operator || item.carrier || "Network",
            service: getServiceName(otpText),
            // 🔥 Magic Fix: Force "Just Now" time
            createdAt: Date.now() - (index * 100) 
          };
        });
      } else {
        console.error("MNIT API Blocked:", response.status);
      }
    } catch (e) {
      console.error("MNIT Fetch Error:", e);
    }

    // 💥 ৩. মিক্স ও সর্টিং 💥
    const mergedLogs = [...mnitLogs, ...localLogs].sort((a, b) => b.createdAt - a.createdAt);
    const top100Logs = mergedLogs.slice(0, 100);

    const recent20Mins = mergedLogs.filter(log => log.createdAt >= twentyMinsAgo);

    const appCounts: Record<string, number> = {};
    const carrierCounts: Record<string, number> = {};

    recent20Mins.forEach((log: any) => {
      appCounts[log.service] = (appCounts[log.service] || 0) + 1;
      carrierCounts[log.operator] = (carrierCounts[log.operator] || 0) + 1;
    });

    let graphData = Object.keys(appCounts)
      .map(key => ({ name: key, value: appCounts[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); 

    let pad = " ";
    while (graphData.length < 8) {
      graphData.push({ name: pad, value: 0 });
      pad += " ";
    }

    const carrierData = Object.keys(carrierCounts)
      .map(key => ({ name: key, value: carrierCounts[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return NextResponse.json({ 
      success: true, 
      logs: top100Logs, 
      graph: graphData,
      carrier: carrierData
    });

  } catch (error: any) {
    console.error("Live Console Merge Error:", error);
    return NextResponse.json({ success: false, error: "Server Merge Error" }, { status: 500 });
  }
}