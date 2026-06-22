// app/api/v1/global-broadcast/route.ts

import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 RAM CACHING & DUPLICATE PREVENTION 💥
const broadcastedIds = new Set();
let lastCleanup = Date.now();

// 💥 SMART SERVICE EXTRACTOR (ঠিক ওয়েবসাইটের কনসোলের মতো কাজ করবে) 💥
const extractServiceName = (msg: string, existingService: string) => {
    // ডাটাবেসে যদি সঠিক নাম থাকে, সেটাই ব্যবহার করবে
    if (existingService && existingService.toLowerCase() !== 'other' && existingService.toLowerCase() !== 'unknown' && existingService.trim() !== '') {
        return existingService;
    }
    
    // ডাটাবেসে না থাকলে SMS-এর টেক্সট পড়ে নাম বের করবে
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
    // TypeScript ফিক্স: explicitly defined as string | null
    const mapikey = req.headers.get("mapikey") as string | null;

    // 💥 STRICT SECURITY: ALLOW MULTIPLE BOT KEYS 💥
    const ALLOWED_BOT_KEYS = [
      "ZNX_A3SRB5MVV7XBIYH1809TGZDD", // Main Bot API Key
      "ZNX_T7DQX8VLPX24SBYNARME128R"  // New Bot API Key
    ];
    
    if (!mapikey || !ALLOWED_BOT_KEYS.includes(mapikey)) {
      return NextResponse.json({ success: false, message: "Unauthorized! Valid Master Key Required." }, { status: 401 });
    }

    await connectToDatabase();

    // 💥 ZERO DB LOAD: Fetch only last 2 minutes of Success Orders 💥
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: twoMinsAgo }
    }).select("_id fullMessage otp searchNumber number service updatedAt").lean();

    const selectedOtps: any[] = [];

    recentOrders.forEach((order: any) => {
        const orderId = order._id.toString();

        // ডুপ্লিকেট চেকিং
        if (!broadcastedIds.has(orderId)) {
            broadcastedIds.add(orderId);

            // 💥 THE 50% MAGIC RULE 💥
            if (Math.random() > 0.5) {
                
                let safeNumber = String(order.searchNumber || order.number || "").replace("+", "");
                
                // 💥 প্ল্যাটফর্মের আসল নাম বের করার লজিক 💥
                const rawMsg = order.fullMessage || order.otp || "";
                const finalServiceName = extractServiceName(rawMsg, order.service);
                
                selectedOtps.push({
                    id: orderId,
                    number: safeNumber,
                    otp: order.otp || order.fullMessage,
                    service: finalServiceName, // এখন আসল নাম যাবে
                    time: order.updatedAt
                });
            }
        }
    });

    // Memory Leak Prevention
    if (Date.now() - lastCleanup > 10 * 60 * 1000) {
        broadcastedIds.clear();
        lastCleanup = Date.now();
    }

    return NextResponse.json({
        success: true,
        count: selectedOtps.length,
        message: "50% Live Public OTPs Fetched Successfully!",
        data: selectedOtps
    });

  } catch (error) {
    console.error("Global Broadcast API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}