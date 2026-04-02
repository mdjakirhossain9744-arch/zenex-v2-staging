import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import LiveLog from "../../../models/LiveLog";

export const dynamic = "force-dynamic";
const MNIT_API_KEY = "M_7VX25KAJI";

// সার্ভিস নাম বের করার ফাংশন
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
    await connectToDatabase();

    // ১. MNIT থেকে লাইভ ডাটা আনা হচ্ছে
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info", {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12)"
      },
      cache: "no-store",
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.data && Array.isArray(result.data.otps)) {
        
        // ২. ডাটাবেসে সেভ করা হচ্ছে (Bulk Upsert - ডুপ্লিকেট হবে না)
        const bulkOps = result.data.otps.map((item: any) => ({
          updateOne: {
            filter: { nid: item.nid || `${item.number}_${item.otp}` },
            update: {
              $set: {
                nid: item.nid || `${item.number}_${item.otp}`,
                number: item.number,
                otp: item.otp,
                country: item.country || "GLOBAL",
                operator: item.operator || "Other",
                service: getServiceName(item.otp),
                createdAt: item.created_at ? new Date(item.created_at) : new Date()
              }
            },
            upsert: true
          }
        }));
        
        if (bulkOps.length > 0) {
          await LiveLog.bulkWrite(bulkOps);
        }
      }
    }

    // ৩. ডাটাবেস থেকে সর্বশেষ ১০০ টি ওটিপি আনা হচ্ছে
    const latestLogs = await LiveLog.find().sort({ createdAt: -1 }).limit(100);

    // ৪. 💥 গ্রাফের জন্য ডাটাবেস থেকে লাইভ কাউন্ট (যেমন MNIT করে) 💥
    const topAppsAgg = await LiveLog.aggregate([
      { $group: { _id: "$service", value: { $sum: 1 } } },
      { $sort: { value: -1 } }, // সবচেয়ে বেশি ওটিপি যেটা, সেটা ১ নম্বরে থাকবে
      { $limit: 8 }
    ]);

    let graphData = topAppsAgg.map(app => ({ name: app._id, value: app.value }));
    
    // চার্ট সুন্দর রাখার জন্য প্যাডিং
    let pad = " ";
    while (graphData.length < 8) {
      graphData.push({ name: pad, value: 0 });
      pad += " ";
    }

    return NextResponse.json({ success: true, logs: latestLogs, graph: graphData });

  } catch (error: any) {
    console.error("Live Console API Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}