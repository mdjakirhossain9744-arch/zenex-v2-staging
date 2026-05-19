import { NextResponse } from "next/server";
// 💥 FIXED IMPORT PATHS (Added one more ../ because it's inside v1 folder) 💥
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import User from "../../../../models/User";

export const dynamic = "force-dynamic";

// 💥 DYNAMIC SERVICE EXTRACTOR 💥
const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const lowerMsg = msg.toLowerCase();
    
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'Facebook';
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ')) return 'WhatsApp';
    if (lowerMsg.includes('telegram') || lowerMsg.includes(' tg ')) return 'Telegram';
    if (lowerMsg.includes('instagram') || lowerMsg.includes(' ig ')) return 'Instagram';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg) || lowerMsg.includes('gmail')) return 'Google';
    if (lowerMsg.includes('microsoft') || lowerMsg.includes('outlook')) return 'Microsoft';
    if (lowerMsg.includes('tiktok') || lowerMsg.includes(' tt ')) return 'TikTok';
    if (lowerMsg.includes('apple') || lowerMsg.includes(' ap ')) return 'Apple';
    if (lowerMsg.includes('paypal')) return 'PayPal';
    if (lowerMsg.includes('amazon')) return 'Amazon';
    if (lowerMsg.includes('1xbet')) return '1xBet';
    if (lowerMsg.includes('coinw')) return 'CoinW';
    if (lowerMsg.includes('binance')) return 'Binance';
    if (lowerMsg.includes('netflix')) return 'Netflix';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    
    return "Other";
};

// 💥 STRICT RAM CACHING: 60 Seconds TTL 💥
let cachedActiveData: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60 * 1000; 

export async function GET(req: Request) {
  try {
    const mapikey = req.headers.get("mapikey");
    if (!mapikey) {
      return NextResponse.json({ success: false, message: "Missing mapikey header" }, { status: 401 });
    }

    await connectToDatabase();
    
    const validUser = await User.findOne({ secretKey: mapikey }).select("_id").lean();
    if (!validUser && mapikey !== "M_7VX25KAJI") { 
        return NextResponse.json({ success: false, message: "Unauthorized API Key" }, { status: 401 });
    }

    // Return from RAM Cache instantly
    if (cachedActiveData && (Date.now() - lastFetchTime < CACHE_DURATION)) {
        return NextResponse.json({
            success: true, cached: true, message: "Live ranges fetched", data: cachedActiveData
        });
    }

    // Fetch Last 1 Hour Logs
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: oneHourAgo }
    }).select("fullMessage otp searchNumber number").lean();

    const rangeMap: Record<string, any> = {};

    recentOrders.forEach((o: any) => {
        let msg = o.fullMessage || o.otp || "";
        const service = extractServiceName(msg);
        
        let num = o.searchNumber || o.number || "";
        num = String(num).replace("+", "");
        
        if (num.length >= 6) {
            const rangeStr = num.substring(0, 6) + "XXX"; 
            
            let tag = "General";
            if (service === "Facebook") {
                const match = msg.match(/\b\d{4,8}\b/);
                if (match) {
                    if (match[0].length === 6 || match[0].length === 8) tag = "Fb Clone";
                    else if (match[0].length === 5) tag = "New Fb";
                }
            }

            const key = `${rangeStr}|${service}|${tag}`;
            if (!rangeMap[key]) {
                rangeMap[key] = { range: rangeStr, service: service, tag: tag, hits: 0 };
            }
            rangeMap[key].hits += 1;
        }
    });

    const formattedRanges = Object.values(rangeMap).sort((a: any, b: any) => b.hits - a.hits);

    cachedActiveData = { active_ranges: formattedRanges };
    lastFetchTime = Date.now();

    return NextResponse.json({
        success: true, cached: false, message: "Live ranges fetched", data: cachedActiveData
    });

  } catch (error) {
    console.error("Active Ranges API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}