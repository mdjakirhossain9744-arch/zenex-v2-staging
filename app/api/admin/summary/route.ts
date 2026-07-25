import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import DailyStat from "../../../../models/DailyStat";
import redis from "../../../lib/redis"; 

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // 💥 Stop Next.js Aggressive Caching 💥

// 💥 THE BOSS FIX: DYNAMIC SERVICE EXTRACTOR 💥
const extractServiceName = (msg: string) => {
    if (!msg) return "Other";

    // 1. Read Exact Tag Injected by Engine-2 AI Scanner
    const serviceMatch = msg.match(/\[Service:\s*([^\]]+)\]/i);
    if (serviceMatch && serviceMatch[1]) {
        return serviceMatch[1].trim(); 
    }

    // 2. Manual Fallback
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ') || lowerMsg.includes('vwaq')) return 'WhatsApp';
    if (lowerMsg.includes('telegram') || lowerMsg.includes('t.me')) return 'Telegram';
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'Facebook';
    if (lowerMsg.includes('instagram') || lowerMsg.includes(' ig ')) return 'Instagram';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg) || lowerMsg.includes('gmail')) return 'Google';
    if (lowerMsg.includes('microsoft') || lowerMsg.includes('outlook')) return 'Microsoft';
    if (lowerMsg.includes('amazon') || lowerMsg.includes('aws')) return 'Amazon';
    if (lowerMsg.includes('netflix')) return 'Netflix';
    if (lowerMsg.includes('paypal')) return 'PayPal';
    if (lowerMsg.includes('tiktok')) return 'TikTok';
    if (lowerMsg.includes('tinder')) return 'Tinder';
    if (lowerMsg.includes('uber') || lowerMsg.includes('airbnb')) return 'Uber';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    if (lowerMsg.includes('imo')) return 'IMO';
    if (lowerMsg.includes('viber')) return 'Viber';

    return "Other"; 
};

// 💥 STRICT UTC TIMEZONE AS PER BOSS COMMAND 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const releaseThread = () => new Promise(resolve => setTimeout(resolve, 0));

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    if (Order.collection && DailyStat.collection) {
        Promise.all([
            Order.collection.createIndex({ dateString: 1 }).catch(() => {}),
            DailyStat.collection.createIndex({ dateString: -1 }).catch(() => {})
        ]).catch(() => {});
    }

    const { email, role, limitDays = 60 } = await req.json();

    const noCacheHeaders = {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    };

    if (role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403, headers: noCacheHeaders });

    const cacheKey = `admin_summary_v3_exact_otp_${limitDays}_UTC`; 
    const cachedData = await redis.get(cacheKey).catch(() => null);

    if (cachedData) {
        let parsedCache;
        try {
            parsedCache = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
            return NextResponse.json(parsedCache, { status: 200, headers: noCacheHeaders });
        } catch (err) {}
    }

    const todayStrUTC = getUTCDateString(new Date());
    const isAllTime = limitDays === "all";

    const dailyStatQuery: any = { dateString: { $lt: todayStrUTC } };
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date(); 
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: todayStrUTC };
    }

    const dailyStatsAgg = await DailyStat.aggregate([
        { $match: dailyStatQuery },
        { $group: { 
            _id: "$dateString", 
            total: { $sum: { $ifNull: ["$totalNumbers", 0] } }, 
            allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
            success: { $sum: { $ifNull: ["$successOTP", 0] } }, 
            failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } }, 
            amount: { $sum: { $add: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalCommission", 0] }] } } 
        } }
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    dailyStatsAgg.forEach((ds: any) => {
        const sCount = ds.success || 0;
        const fCount = ds.failed || 0;
        let finalTotal = ds.total || ds.allocation || 0;
        if (finalTotal === 0 && (sCount > 0 || fCount > 0)) finalTotal = sCount + fCount;

        groupedRawData[ds._id] = { total: finalTotal, allocation: finalTotal, success: sCount, failed: fCount, amount: ds.amount || 0 };
    });

    groupedRawData[todayStrUTC] = { total: 0, allocation: 0, success: 0, failed: 0, amount: 0 };

    const ordersCursor = Order.find({ dateString: todayStrUTC })
        .select("status createdAt updatedAt fullMessage orderCost orderCommission processedKeys")
        .lean()
        .cursor();

    let counter = 0;
    for await (const o of ordersCursor) {
        counter++;
        if (counter % 500 === 0) await releaseThread(); 

        const currentStatus = (o.status || "").toUpperCase(); 
        
        groupedRawData[todayStrUTC].total += 1;
        groupedRawData[todayStrUTC].allocation += 1; 

        if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
            let exactValidCount = 0;
            if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) exactValidCount = o.processedKeys.length;
            else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
                const msgArray = o.fullMessage.split(/_\|\|_/);
                msgArray.forEach((m: string) => { 
                    if (m.trim() !== "" && !m.toLowerCase().includes("waiting")) exactValidCount += 1; 
                });
            }
            if (exactValidCount === 0) exactValidCount = 1;

            groupedRawData[todayStrUTC].success += exactValidCount;
            groupedRawData[todayStrUTC].amount += ((o.orderCost || 0) + (o.orderCommission || 0));

            const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
            const bIdx = Math.floor(hour / 4);
            if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

            let sName = extractServiceName(o.fullMessage);
            todayAppCounts[sName] = (todayAppCounts[sName] || 0) + exactValidCount;
            
        } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING"].includes(currentStatus)) {
            groupedRawData[todayStrUTC].failed += 1;
        }
    }

    const yesterdayDate = new Date(); 
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, allocation: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    const responsePayload = {
        success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
        serverDate: todayStrUTC, todaySuccess: todayData.success, todaySpend: todayData.amount, 
        yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    };

    // Store in Redis for exactly 15 seconds to match UI
    await redis.set(cacheKey, JSON.stringify(responsePayload), "EX", 15).catch(() => null);
    
    return NextResponse.json(responsePayload, { headers: noCacheHeaders });

  } catch (error) { return NextResponse.json({ success: false }, { status: 500 }); }
}