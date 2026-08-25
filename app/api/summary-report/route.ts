import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";
import mongoose from "mongoose"; // 💥 Kept to avoid any module resolution errors per strict rules

export const dynamic = "force-dynamic";

// 💥 STRICT UTC TIMEZONE AS PER BOSS COMMAND 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    // 💥 CRITICAL OPTIMIZATION: Removed legacy DB fetch for dynamicServices 💥

    const { email, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    const exactDbEmail = currentUser.email; 
    
    // 💥 THE GREAT USDT MIGRATION: 4-Decimal Precision for UI Global Variables 💥
    let userRate = Number((currentUser.otpRate || 0).toFixed(4));
    let balance = Number((currentUser.balance || 0).toFixed(4));
    
    const todayStrUTC = getUTCDateString(new Date());
    
    // 💥 SMART DATE FIREWALL: Prevent DDOS & Full Table Scans 💥
    const accountAgeMs = Date.now() - new Date(currentUser.createdAt || Date.now()).getTime();
    const accountAgeDays = Math.max(1, Math.ceil(accountAgeMs / (1000 * 60 * 60 * 24)));
    
    let safeLimitNum = 60;
    if (limitDays === "all") {
        // If "All Time", limit strictly to account creation date (max 365 days to prevent crash)
        safeLimitNum = Math.min(accountAgeDays, 365);
    } else {
        let parsedDays = Number(limitDays);
        if (isNaN(parsedDays) || parsedDays < 1) parsedDays = 7; // Fallback to 7 days if user sends garbage
        if (parsedDays > accountAgeDays) parsedDays = accountAgeDays; // Cannot fetch dates before account existed
        if (parsedDays > 365) parsedDays = 365; // Hard max limit for safety
        safeLimitNum = parsedDays;
    }

    // Force isAllTime to false so our firewall bounded limit is ALWAYS applied to the DB query
    const isAllTime = false; 

    let liveQueryDateStr = todayStrUTC;
    const currentUTCHour = new Date().getUTCHours();
    const currentUTCMin = new Date().getUTCMinutes();
    
    if (currentUTCHour === 0 && currentUTCMin <= 35) {
        const yesterdayDate = new Date();
        yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        liveQueryDateStr = getUTCDateString(yesterdayDate);
    }
    
    const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr }, userEmail: exactDbEmail };
    
    if (!isAllTime) {
        const limitNum = safeLimitNum; // 💥 Firewalled limit applied here 💥
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
    }

    const orderQuery: any = { dateString: { $gte: liveQueryDateStr }, userEmail: exactDbEmail }; 

    // 💥 USER MATH: Cost Only (No Commission) + trueService injected to avoid heavy Regex 💥
    const [dailyStatsAgg, orders] = await Promise.all([
        DailyStat.aggregate([
            { $match: dailyStatQuery },
            { $group: {
                _id: "$dateString",
                total: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                success: { $sum: { $ifNull: ["$successOTP", 0] } },
                failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } },
                amount: { $sum: { $ifNull: ["$totalCost", 0] } }
            }}
        ]),
        Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage orderCost processedKeys trueService").lean()
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    // 🔥 Total Fix Logic Applied
    dailyStatsAgg.forEach((ds: any) => {
        let finalTotal = ds.total || ds.allocation || 0;
        if (finalTotal === 0 && (ds.success > 0 || ds.failed > 0)) {
            finalTotal = ds.success + ds.failed;
        }
        // 💥 THE GREAT USDT MIGRATION: 4-Decimal Precision for Past Data 💥
        groupedRawData[ds._id] = { 
            total: finalTotal, 
            allocation: finalTotal, 
            success: ds.success, 
            failed: ds.failed, 
            amount: Number((ds.amount || 0).toFixed(4)) 
        };
    });

    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 
       const finalDateStr = o.dateString || getUTCDateString(o.createdAt);
       if (finalDateStr < liveQueryDateStr) return; 

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       groupedRawData[finalDateStr].total += 1; groupedRawData[finalDateStr].allocation += 1;

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          
          // 🔥 EXACT MULTI-OTP LOGIC INJECTED 🔥
          let exactValidCount = 0;
          if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) {
              exactValidCount = o.processedKeys.length;
          } else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
              const msgArray = o.fullMessage.split(/_\|\|_/);
              msgArray.forEach((m: string) => {
                  const cleanMsg = m.trim().toLowerCase();
                  if (cleanMsg !== "" && !cleanMsg.includes("waiting")) exactValidCount += 1;
              });
          }
          if (exactValidCount === 0) exactValidCount = 1;

          groupedRawData[finalDateStr].success += exactValidCount;
          
          // 💥 THE GREAT USDT MIGRATION: 4-Decimal Accumulation (Avoid Floating Errors) 💥
          groupedRawData[finalDateStr].amount = Number((groupedRawData[finalDateStr].amount + (o.orderCost || 0)).toFixed(4)); 

          if (finalDateStr === todayStrUTC) {
              const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

              // 💥 V2 ULTRA-FAST AGGREGATION: Direct O(1) DB Lookup (No Regex/Text Scanning) 💥
              const sName = (o.trueService && o.trueService !== "Unknown") ? o.trueService : "Other";
              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += exactValidCount;
          }
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    const yesterdayDate = new Date(); yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrUTC,
       todaySuccess: todayData.success, 
       todaySpend: Number((todayData.amount || 0).toFixed(4)), // 💥 4-Decimal Safe Output
       yesterdaySuccess: yesterdayData.success, 
       yesterdaySpend: Number((yesterdayData.amount || 0).toFixed(4)) // 💥 4-Decimal Safe Output
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}