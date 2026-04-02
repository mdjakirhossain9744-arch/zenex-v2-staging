import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import LiveLog from "../../../models/LiveLog";

// 💥 Next.js এর নিজস্ব সুপার পাওয়ারফুল ৫ সেকেন্ড ক্যাশ (Serverless Freeze হবে না) 💥
export const revalidate = 5; 

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
    await connectToDatabase();

    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info", {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12)",
        "Cache-Control": "no-cache"
      }
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
                  service: getServiceName(item.otp)
                },
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

    // 💥 মেইন ম্যাজিক: ডাটাবেস থেকে জোর করে শুধুমাত্র শেষ ২০ মিনিটের ডাটা আনা হচ্ছে 💥
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    const latestLogs = await LiveLog.find({ createdAt: { $gte: twentyMinsAgo } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100);

    const topAppsAgg = await LiveLog.aggregate([
      { $match: { createdAt: { $gte: twentyMinsAgo } } }, // গ্রাফেও শুধু ২০ মিনিটের হিসাব
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

    return NextResponse.json({ success: true, logs: latestLogs, graph: graphData });

  } catch (error: any) {
    console.error("Live Console Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}