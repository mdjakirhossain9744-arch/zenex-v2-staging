import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import LiveLog from "../../../models/LiveLog";

// 💥 Vercel এবং Next.js এর সব ক্যাশ চিরতরে অফ! 💥
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
    await connectToDatabase();

    // 💥 ম্যাজিক ১: MNIT এর Cloudflare ক্যাশ ভাঙার জন্য লাইভ টাইমস্ট্যাম্প যুক্ত করা হলো! 💥
    const mnitUrl = `https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${Date.now()}`;

    const response = await fetch(mnitUrl, {
      method: "GET",
      headers: {
        "mapikey": MNIT_API_KEY, 
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12)",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      },
      cache: "no-store",
    });

    if (response.ok) {
      const result = await response.json();
      if (result && result.data && Array.isArray(result.data.otps)) {
        
        const bulkOps = result.data.otps.map((item: any) => {
          // MNIT এর অরিজিনাল টাইম নেওয়া হচ্ছে, যাতে সবগুলোর টাইম এক না হয়ে যায়
          const mnitTime = item.created_at ? new Date(item.created_at) : new Date();
          const uniqueId = item.nid || `${item.number}_${item.otp}`;

          return {
            updateOne: {
              filter: { nid: uniqueId },
              update: {
                $set: {
                  nid: uniqueId,
                  number: item.number,
                  otp: item.otp,
                  country: item.country || "GLOBAL",
                  operator: item.operator || "Other",
                  service: getServiceName(item.otp)
                },
                $setOnInsert: {
                  createdAt: mnitTime
                }
              },
              upsert: true
            }
          };
        });
        
        if (bulkOps.length > 0) {
          try {
            await LiveLog.bulkWrite(bulkOps, { ordered: false });
          } catch (e) {
            // ডুপ্লিকেট ইগনোর
          }
        }
      }
    }

    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    // 💥 ম্যাজিক ২: ডাটাবেসের ভরসায় না থেকে, কোড দিয়ে জোর করে ২০ মিনিটের পুরনো ডাটা ডিলিট! 💥
    await LiveLog.deleteMany({ createdAt: { $lt: twentyMinsAgo } });

    // 💥 ম্যাজিক ৩: ফ্রেশ ডাটা আনা হচ্ছে 💥
    const latestLogs = await LiveLog.find({ createdAt: { $gte: twentyMinsAgo } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100);

    const topAppsAgg = await LiveLog.aggregate([
      { $match: { createdAt: { $gte: twentyMinsAgo } } }, 
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

    // কোনো ক্যাশ ভেরিয়েবল নেই, একদম ফ্রেশ ডাটা পাঠানো হচ্ছে
    return NextResponse.json({ success: true, logs: latestLogs, graph: graphData });

  } catch (error: any) {
    console.error("Live Console Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}