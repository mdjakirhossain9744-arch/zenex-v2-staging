import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import DailyStat from "../../../../models/DailyStat";
import redis from "../../../lib/redis"; 

export const dynamic = "force-dynamic";

const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ')) return 'WhatsApp';
    if (lowerMsg.includes('telegram') || lowerMsg.includes('t.me')) return 'Telegram';
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'Facebook';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg) || lowerMsg.includes('gmail')) return 'Google';
    return "Other"; 
};

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

    if (role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    // 💥 CACHE KEY CHANGED: নতুন পারফেক্ট কাউন্টিংয়ের জন্য ক্যাশ রিফ্রেশ করা হলো!
    const cacheKey = `admin_summary_v3_exact_otp_${limitDays}`; 
    const cachedData = await redis.get(cacheKey).catch(() => null);

    if (cachedData) {
        let parsedCache;
        try {
            parsedCache = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
            return NextResponse.json(parsedCache, { status: 200 });
        } catch (err) {}
    }

    const todayStrUTC = getUTCDateString(new Date());
    const isAllTime = limitDays === "all";

    const dailyStatQuery: any = { dateString: { $lt: todayStrUTC } };
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date(); pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
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

    // 💥 BULLETPROOF MATH FIX: ডাটাবেসে Total না থাকলে নিজে যোগ করে নিবে!
    dailyStatsAgg.forEach((ds: any) => {
        const sCount = ds.success || 0;
        const fCount = ds.failed || 0;
        
        let finalTotal = ds.total || ds.allocation || 0;
        
        if (finalTotal === 0 && (sCount > 0 || fCount > 0)) {
            finalTotal = sCount + fCount;
        }

        groupedRawData[ds._id] = { 
            total: finalTotal, 
            allocation: finalTotal, 
            success: sCount, 
            failed: fCount, 
            amount: ds.amount || 0 
        };
    });

    groupedRawData[todayStrUTC] = { total: 0, allocation: 0, success: 0, failed: 0, amount: 0 };

    // 🔥 MISSION 1 FIX: Added 'processedKeys' to securely count ONLY real charged OTPs
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
            
            // 🚀 SMART EXACT COUNT LOGIC: Source of truth is processedKeys (Engine-2 Pay Area)
            let exactValidCount = 0;
            
            if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) {
                exactValidCount = o.processedKeys.length;
            } 
            else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
                const msgArray = o.fullMessage.split(/_\|\|_/);
                msgArray.forEach((m: string) => { 
                    if (m.trim() !== "" && !m.toLowerCase().includes("waiting")) {
                        exactValidCount += 1; 
                    }
                });
            }

            // Fallback for single old completed records
            if (exactValidCount === 0) exactValidCount = 1;

            groupedRawData[todayStrUTC].success += exactValidCount;
            // 💰 Note: orderCost and orderCommission holds the cumulative deducted amount by Engine-2
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

    const yesterdayDate = new Date(); yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, allocation: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    const responsePayload = {
        success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
        serverDate: todayStrUTC, todaySuccess: todayData.success, todaySpend: todayData.amount, 
        yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    };

    await redis.set(cacheKey, JSON.stringify(responsePayload), "EX", 60).catch(() => null);
    
    return NextResponse.json(responsePayload);

  } catch (error) { return NextResponse.json({ success: false }); }
}