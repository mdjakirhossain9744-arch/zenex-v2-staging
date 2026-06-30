import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import User from "../../../../models/User";
import DailyStat from "../../../../models/DailyStat";
import redis from "../../../lib/redis"; 

export const dynamic = "force-dynamic";

let isGeneratingCache = false;

const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ')) return 'WhatsApp';
    if (lowerMsg.includes('telegram') || lowerMsg.includes('t.me')) return 'Telegram';
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'Facebook';
    if (lowerMsg.includes('instagram') || lowerMsg.includes(' ig ')) return 'Instagram';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg) || lowerMsg.includes('gmail')) return 'Google';
    if (lowerMsg.includes('tiktok')) return 'TikTok';
    return "Other"; 
};

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

// 💥 THE CRASH PREVENTER: Helper function to let the server breathe 💥
const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

async function generateHeavyAdminSummary(limitDays: any, cacheKey: string) {
    try {
        const todayStrUTC = getUTCDateString(new Date());
        const isAllTime = limitDays === "all";

        let liveQueryDateStr = todayStrUTC;
        const currentUTCHour = new Date().getUTCHours();
        const currentUTCMin = new Date().getUTCMinutes();
        
        if (currentUTCHour === 0 && currentUTCMin <= 35) {
            const yesterdayDate = new Date();
            yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
            liveQueryDateStr = getUTCDateString(yesterdayDate);
        }
        
        const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr } };
        
        if (!isAllTime) {
            const limitNum = Number(limitDays) || 60;
            const pastDaysLimit = new Date();
            pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
            dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
        }

        const orderQuery: any = { dateString: { $gte: liveQueryDateStr } }; 

        const dailyStatsAgg = await DailyStat.aggregate([
            { $match: dailyStatQuery },
            { $group: {
                _id: "$dateString",
                total: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                success: { $sum: { $ifNull: ["$successOTP", 0] } },
                failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } },
                amount: { $sum: { $add: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalCommission", 0] }] } }
            }}
        ]);

        const groupedRawData: Record<string, any> = {};
        const todayAppCounts: Record<string, number> = {};
        const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

        dailyStatsAgg.forEach((ds: any) => {
            groupedRawData[ds._id] = { total: ds.total, allocation: ds.allocation, success: ds.success, failed: ds.failed, amount: ds.amount };
        });

        const ordersCursor = Order.find(orderQuery)
            .select("status dateString createdAt updatedAt fullMessage orderCost orderCommission")
            .lean()
            .cursor();

        let loopCounter = 0; // 💥 Track how many items processed

        for await (const o of ordersCursor) {
           // 💥 THE MAGIC FIX: Prevent Node.js from freezing the whole server
           loopCounter++;
           if (loopCounter % 500 === 0) {
               await yieldToEventLoop(); // Server will serve users, then resume counting
           }

           const currentStatus = (o.status || "").toUpperCase(); 
           const finalDateStr = o.dateString || getUTCDateString(o.createdAt);
           if (finalDateStr < liveQueryDateStr) continue; 

           if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
           groupedRawData[finalDateStr].total += 1; groupedRawData[finalDateStr].allocation += 1;

           if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
              const msgArray = o.fullMessage ? o.fullMessage.split(/_\|\|_/) : [];
              let finalValidCount = 0;
              msgArray.forEach((m: string) => { if (m.trim() !== "" && !m.toLowerCase().includes("waiting")) finalValidCount += 1; });
              if (finalValidCount === 0) finalValidCount = 1;

              groupedRawData[finalDateStr].success += finalValidCount;
              groupedRawData[finalDateStr].amount += ((o.orderCost || 0) + (o.orderCommission || 0));

              if (finalDateStr === todayStrUTC) {
                  const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
                  const bIdx = Math.floor(hour / 4);
                  if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += finalValidCount;

                  let sName = extractServiceName(o.fullMessage);
                  if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
                  todayAppCounts[sName] += finalValidCount;
              }
           } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
              groupedRawData[finalDateStr].failed += 1;
           }
        }

        const yesterdayDate = new Date(); yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        const yesterdayStrUTC = getUTCDateString(yesterdayDate);

        const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
        const todayData = groupedRawData[todayStrUTC] || defaultData;
        const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

        const responsePayload = {
           success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
           userRate: 0, balance: 0, serverDate: todayStrUTC,
           todaySuccess: todayData.success, todaySpend: todayData.amount, 
           yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
        };

        await redis.setex(cacheKey, 120, JSON.stringify(responsePayload));

    } catch (error) {
        console.error("Background Cache Error:", error);
    } finally {
        isGeneratingCache = false;
    }
}

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, role, limitDays = 60 } = await req.json();

    if (role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const cacheKey = `admin_summary_v3_${limitDays}`; 

    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
        return new NextResponse(cachedData, {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!isGeneratingCache) {
        isGeneratingCache = true;
        generateHeavyAdminSummary(limitDays, cacheKey); 
    }

    return NextResponse.json({
        success: true,
        isProcessing: true, 
        message: "⏳ Fetching live enterprise data. Please refresh in 10-15 seconds...",
        groupedRawData: {}, todayAppCounts: {}, todayHourlyTraffic: [0, 0, 0, 0, 0, 0],
        todaySuccess: 0, todaySpend: 0, yesterdaySuccess: 0, yesterdaySpend: 0
    });

  } catch (error) { 
      return NextResponse.json({ success: false }); 
  }
}