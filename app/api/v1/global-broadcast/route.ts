import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
// বস, আপনার প্রজেক্টের Redis কনফিগারেশনের পাথ অনুযায়ী নিচের ইম্পোর্টটি মিলিয়ে নিবেন। 
// যদি এই ফাইলে Redis না থাকে, তবে শুধু revalidate (ISR) ডাটাবেজকে ১০০% সেভ করবে।
import redis from "../../../lib/redis"; 

// 💥 NEXT.JS ISR CACHE: 0% Database Load from API Spam 💥
// "force-dynamic" রিমুভ করে "revalidate = 10" দেওয়া হলো। 
// ফলে বট সেকেন্ডে ১০০০ বার হিট করলেও Next.js মাত্র ১০ সেকেন্ড পর পর একবার ফাংশনটি রান করবে।
export const revalidate = 10; 

// 💥 SMART SERVICE EXTRACTOR 💥
const extractServiceName = (msg: string, existingService: string) => {
    if (existingService && existingService.toLowerCase() !== 'other' && existingService.toLowerCase() !== 'unknown' && existingService.trim() !== '') {
        return existingService;
    }
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
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    
    return "Other";
};

export async function GET(req: Request) {
  try {
    const mapikey = req.headers.get("mapikey") as string | null;

    // 💥 STRICT SECURITY: ALLOW MULTIPLE BOT KEYS 💥
    const ALLOWED_BOT_KEYS = [
      "ZNX_A3SRB5MVV7XBIYH1809TGZDD", // Main Bot API Key
      "ZNX_T7DQX8VLPX24SBYNARME128R"  // New Bot API Key
    ];
    
    if (!mapikey || !ALLOWED_BOT_KEYS.includes(mapikey)) {
      return NextResponse.json({ success: false, message: "Unauthorized! Valid Master Key Required." }, { status: 401 });
    }

    // 💥 LAYER 1: REDIS IN-MEMORY CACHE (O(1) Fetch) 💥
    const CACHE_KEY = "zenex_bot_broadcast_2mins";
    if (redis) {
        const cachedData = await redis.get(CACHE_KEY);
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            return NextResponse.json({
                success: true,
                count: parsedData.length,
                message: "Live Public OTPs Fetched Successfully! (Served from ⚡ Redis Cache)",
                data: parsedData
            });
        }
    }

    // 💥 LAYER 2: FALLBACK TO DATABASE (Runs only once every 10 seconds) 💥
    await connectToDatabase();

    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: twoMinsAgo }
    }).select("_id fullMessage otp searchNumber number service updatedAt").lean();

    const selectedOtps: any[] = [];

    recentOrders.forEach((order: any) => {
        // 💥 THE 50% MAGIC RULE 💥
        if (Math.random() > 0.5) {
            let safeNumber = String(order.searchNumber || order.number || "").replace("+", "");
            const rawMsg = order.fullMessage || order.otp || "";
            const finalServiceName = extractServiceName(rawMsg, order.service);
            
            selectedOtps.push({
                id: order._id.toString(),
                number: safeNumber,
                otp: order.otp || order.fullMessage,
                service: finalServiceName,
                time: order.updatedAt
            });
        }
    });

    // 💥 SAVE TO REDIS CACHE FOR 10 SECONDS (Protecting MongoDB) 💥
    if (redis) {
        await redis.set(CACHE_KEY, JSON.stringify(selectedOtps), "EX", 10);
    }

    return NextResponse.json({
        success: true,
        count: selectedOtps.length,
        message: "Live Public OTPs Fetched Successfully! (Database Hit - Now Cached)",
        data: selectedOtps
    });

  } catch (error) {
    console.error("Global Broadcast API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}