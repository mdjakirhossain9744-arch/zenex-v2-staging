import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import LiveLog from "../../../models/LiveLog";

export const dynamic = "force-dynamic";
const MNIT_API_KEY = "M_7VX25KAJI";

let cachedData: any = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 5000; // 💥 ৫ সেকেন্ড ক্যাশ 💥

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
    const currentTime = Date.now();
    if (cachedData && (currentTime - lastFetchTime < CACHE_DURATION)) {
      return NextResponse.json(cachedData);
    }

    await connectToDatabase();

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
        
        try {
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
                },
                // 💥 ম্যাজিক: টাইম শুধু একবার সেভ হবে, এরপর আর চেঞ্জ হবে না! 💥
                $setOnInsert: {
                  createdAt: new Date()
                }
              },
              upsert: true
            }
          }));
          
          if (bulkOps.length > 0) {
            await LiveLog.bulkWrite(bulkOps, { ordered: false });
          }
        } catch (e) {
          // ডুপ্লিকেট ইগনোর
        }
      }
    }

    // ডাটাবেস থেকে লাস্ট ১০০টি ওটিপি আনা হচ্ছে (যেহেতু টাইম লকড, তাই রিয়েল নতুনগুলোই উপরে আসবে)
    const latestLogs = await LiveLog.find().sort({ createdAt: -1 }).limit(100);

    // গ্রাফের জন্য লাস্ট ২০ মিনিটের কাউন্ট
    const topAppsAgg = await LiveLog.aggregate([
      { $group: { _id: "$service", value: { $sum: 1 } } },
      { $sort: { value: -1 } }, 
      { $limit: 8 }
    ]);

    let graphData = topAppsAgg.map(app => ({ name: app._id, value: app.value }));
    let pad = " ";
    while (graphData.length < 8) {
      graphData.push({ name: pad, value: 0 });
      pad += " ";
    }

    cachedData = { success: true, logs: latestLogs, graph: graphData };
    lastFetchTime = currentTime;

    return NextResponse.json(cachedData);

  } catch (error: any) {
    console.error("Live Console Error:", error);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}