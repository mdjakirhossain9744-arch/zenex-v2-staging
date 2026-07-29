import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import Order from "../../../models/Order"; 

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// 💥 SERVER-SIDE IN-MEMORY CACHE (Database Protector) 💥
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 4000; // 4 seconds cache

// 💥 THE BOSS FIX: DYNAMIC SERVICE EXTRACTOR (UPPERCASE for UI Colors & Bold Charts) 💥
const extractServiceName = (msg: string) => {
    if (!msg) return "OTHER";

    // 1. Read Exact Tag Injected by Engine-2 AI Scanner & Make it UPPERCASE
    const serviceMatch = msg.match(/\[Service:\s*([^\]]+)\]/i);
    if (serviceMatch && serviceMatch[1]) {
        return serviceMatch[1].trim().toUpperCase(); 
    }

    // 2. Manual Fallback (Returns UPPERCASE for UI color matching)
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ') || lowerMsg.includes('vwaq')) return 'WHATSAPP';
    if (lowerMsg.includes('telegram') || lowerMsg.includes('t.me')) return 'TELEGRAM';
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'FACEBOOK';
    if (lowerMsg.includes('instagram') || lowerMsg.includes(' ig ')) return 'INSTAGRAM';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg) || lowerMsg.includes('gmail')) return 'GOOGLE';
    if (lowerMsg.includes('microsoft') || lowerMsg.includes('outlook')) return 'MICROSOFT';
    if (lowerMsg.includes('amazon') || lowerMsg.includes('aws')) return 'AMAZON';
    if (lowerMsg.includes('netflix')) return 'NETFLIX';
    if (lowerMsg.includes('paypal')) return 'PAYPAL';
    if (lowerMsg.includes('tiktok')) return 'TIKTOK';
    if (lowerMsg.includes('tinder')) return 'TINDER';
    if (lowerMsg.includes('uber') || lowerMsg.includes('airbnb')) return 'UBER';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'TWITTER/X';
    if (lowerMsg.includes('imo')) return 'IMO';
    if (lowerMsg.includes('viber')) return 'VIBER';

    return "OTHER"; 
};

export async function GET(req: NextRequest) {
  try {
    // 💥 1. CACHE INTERCEPTOR: Serve instantly from RAM to save DB 💥
    if (cachedData && (Date.now() - lastFetchTime < CACHE_TTL)) {
      return NextResponse.json(cachedData);
    }

    await connectToDatabase();

    const oneHourAgoDate = new Date(Date.now() - 60 * 60 * 1000); 

    // 💥 2. QUERY ONE (For Charts): Fetch Unlimited Logs for exact 1-Hour calculation 💥
    const statsOrders = await Order.find({ 
      status: { $in: ["DONE", "Success"] },
      updatedAt: { $gte: oneHourAgoDate } 
    })
    .select("fullMessage otp operator") 
    .lean();

    const appCounts: Record<string, number> = {};
    const carrierCounts: Record<string, number> = {};

    statsOrders.forEach((log: any) => {
      // 💥 AI Extractor applied here for the Bar Chart! 💥
      const service = extractServiceName(log.fullMessage || log.otp);
      const op = log.operator || "Other";
      appCounts[service] = (appCounts[service] || 0) + 1;
      carrierCounts[op] = (carrierCounts[op] || 0) + 1;
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

    // 💥 3. QUERY TWO (For UI Feed): Fetch ONLY the latest 50 logs 💥
    const feedOrders = await Order.find({ status: { $in: ["DONE", "Success"] } })
      .sort({ updatedAt: -1 }) 
      .select("searchNumber number fullMessage otp country operator createdAt updatedAt") 
      .limit(50) 
      .lean();

    // 🛡️ 100% BULLETPROOF SERVER-SIDE DATA MASKING 🛡️
    const localLogs = feedOrders.map((log: any) => {
      const rawNum = log.searchNumber || log.number || "";
      // Mask Number: 23672928354 -> 23672928XXX
      const maskedNum = rawNum.length > 4 ? rawNum.slice(0, -3) + "XXX" : rawNum;
      
      const rawMsg = log.fullMessage || log.otp || "";
      // Mask Message: ALL digits are replaced with * (e.g. 58392 is your code -> ***** is your code)
      const maskedMsg = rawMsg.replace(/\d/g, '*'); 

      return {
        id: log._id.toString(),
        number: maskedNum, // HACKER WILL NEVER SEE THE FULL NUMBER
        otp: maskedMsg,    // HACKER WILL NEVER SEE THE REAL OTP
        country: log.country || "BD",
        operator: log.operator || "Other",
        service: extractServiceName(rawMsg), // Apply AI Extractor here too
        createdAt: new Date(log.updatedAt || log.createdAt).getTime()
      };
    });

    // 💥 4. SAVE TO RAM CACHE AND RETURN 💥
    cachedData = { 
      success: true, 
      logs: localLogs, 
      graph: graphData, 
      carrier: carrierData
    };
    lastFetchTime = Date.now();

    return NextResponse.json(cachedData);

  } catch (error: any) {
    console.error("Live Console Critical Error:", error.message);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}