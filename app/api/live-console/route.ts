import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import LiveLog from "../../../models/LiveLog";

// 💥 Vercel Edge Caching চিরতরে ধ্বংস করার কমান্ড 💥
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

    const mnitUrl = `https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${Date.now()}`;

    // 🚀 Ultimate Fetch Strategy: Next.js 14 এর ক্যাশ ফোর্স-কিল করা হলো
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
      next: { revalidate: 0 } // 🔥 এটাই সবচেয়ে ইম্পর্টেন্ট লাইন! Vercel আর ক্যাশ ধরতে পারবে না।
    });

    // Cloudflare বা MNIT ব্লক করছে কিনা তা সার্ভার লগে ধরার জন্য
    if (!response.ok) {
       console.error("MNIT API Blocked:", response.status, await response.text());
    }

    if (response.ok) {
      const result = await response.json();
      if (result && result.data && Array.isArray(result.data.otps)) {
        
        const bulkOps = result.data.otps.map((item: any) => {
          // Unique ID নিশ্চিত করা হলো
          const uniqueId = item.nid ? String(item.nid) : `${item.number}_${item.otp}`;

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
                  createdAt: new Date()
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

    // টাইমজোন ফিক্স: বর্তমান সময় থেকে ২০ মিনিট আগের ডাটা
    const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);

    // ২০ মিনিটের পুরনো ডাটা ডিলিট
    await LiveLog.deleteMany({ createdAt: { $lt: twentyMinsAgo } });

    // ফ্রেশ ডাটা আনা হচ্ছে (সবার নতুন ডাটা একদম উপরে থাকবে)
    const latestLogs = await LiveLog.find({ createdAt: { $gte: twentyMinsAgo } })
      .sort({ createdAt: -1 }) 
      .limit(100);

    // ಗ್ರಾফ ডাটা
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

    return NextResponse.json({ 
        success: true, 
        logs: latestLogs, 
        graph: graphData,
        serverTime: new Date().toISOString() // ফ্রন্টএন্ডকে বোঝানোর জন্য যে সার্ভার লাইভ আছে
    });

  } catch (error: any) {
    console.error("Live Console Error:", error);
    return NextResponse.json({ success: false, error: "Network Error" }, { status: 500 });
  }
}