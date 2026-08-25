import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import DailyStat from "../../../../models/DailyStat";
import redis from "../../../lib/redis"; 
import mongoose from "mongoose"; 

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // 💥 Stop Next.js Aggressive Caching 💥

// 💥 STRICT UTC TIMEZONE AS PER BOSS COMMAND 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const releaseThread = () => new Promise(resolve => setTimeout(resolve, 0));

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    // 💥 FETCH DYNAMIC SERVICES FROM DB 💥
    const settingsCollection = mongoose.connection.collection("system_settings");
    const sysSettings = await settingsCollection.findOne({ type: "global" });
    const dynamicServices = sysSettings?.dynamicServices || [];

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

    // 💥 SMART DATE FIREWALL (Global Admin Edition): Prevent DDOS & Full Table Scans 💥
    let safeLimitNum = 60;
    if (limitDays === "all") {
        safeLimitNum = 365; // Hard lock to 1 year max to protect DB memory
    } else {
        let parsedDays = Number(limitDays);
        if (isNaN(parsedDays) || parsedDays < 1) parsedDays = 7; // Fallback for garbage input
        if (parsedDays > 365) parsedDays = 365; // Cannot fetch more than 365 days
        safeLimitNum = parsedDays;
    }

    // Force isAllTime to false to ensure DB bounded query
    const isAllTime = false; 

    // Use safeLimitNum in Cache Key to prevent cache fragmentation attacks
    const cacheKey = `admin_summary_v3_exact_otp_${safeLimitNum}_UTC`; 
    const cachedData = await redis.get(cacheKey).catch(() => null);

    if (cachedData) {
        let parsedCache;
        try {
            parsedCache = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
            return NextResponse.json(parsedCache, { status: 200, headers: noCacheHeaders });
        } catch (err) {}
    }

    const todayStrUTC = getUTCDateString(new Date());

    const dailyStatQuery: any = { dateString: { $lt: todayStrUTC } };
    
    if (!isAllTime) {
        const limitNum = safeLimitNum; // 💥 Firewalled limit applied here 💥
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

        groupedRawData[ds._id] = { 
            total: finalTotal, 
            allocation: finalTotal, 
            success: sCount, 
            failed: fCount, 
            // 💥 THE GREAT USDT MIGRATION: 4-Decimal Precision for DB Summary 💥
            amount: Number((ds.amount || 0).toFixed(4)) 
        };
    });

    groupedRawData[todayStrUTC] = { total: 0, allocation: 0, success: 0, failed: 0, amount: 0 };

    // 💥 BOSS FIX: Added `trueService` in select query to bypass heavy CPU regex scanner 💥
    const ordersCursor = Order.find({ dateString: todayStrUTC })
        .select("status createdAt updatedAt fullMessage orderCost orderCommission processedKeys trueService")
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
            
            // 💥 THE GREAT USDT MIGRATION: 4-Decimal Accumulation 💥
            groupedRawData[todayStrUTC].amount = Number((groupedRawData[todayStrUTC].amount + (o.orderCost || 0) + (o.orderCommission || 0)).toFixed(4));

            const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
            const bIdx = Math.floor(hour / 4);
            if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

            // 💥 V2 ULTRA-FAST AGGREGATION: Use TrueService from DB instead of slow Scanner 💥
            let sName = (o.trueService && o.trueService !== "Unknown") ? o.trueService : "Other";
            
            if (dynamicServices.length > 0 && dynamicServices.map((d:string)=>d.toLowerCase()).includes(sName.toLowerCase())) {
                sName = dynamicServices.find((d:string) => d.toLowerCase() === sName.toLowerCase()) || sName;
            }
            
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
        serverDate: todayStrUTC, 
        todaySuccess: todayData.success, 
        todaySpend: Number((todayData.amount || 0).toFixed(4)), // 💥 4-Decimal Final Output
        yesterdaySuccess: yesterdayData.success, 
        yesterdaySpend: Number((yesterdayData.amount || 0).toFixed(4)) // 💥 4-Decimal Final Output
    };

    // Store in Redis for exactly 15 seconds to match UI
    await redis.set(cacheKey, JSON.stringify(responsePayload), "EX", 15).catch(() => null);
    
    return NextResponse.json(responsePayload, { headers: noCacheHeaders });

  } catch (error) { return NextResponse.json({ success: false }, { status: 500 }); }
}