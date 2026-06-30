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

const releaseThread = () => new Promise(resolve => setTimeout(resolve, 1));

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, role, limitDays = 60 } = await req.json();

    if (role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const cacheKey = `admin_summary_absolute_${limitDays}`; 
    const cachedData = await redis.get(cacheKey);

    // 💥 REDIS INSTANT RESPONSE (0.01s)
    if (cachedData) {
        return new NextResponse(cachedData, { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 💥 IF NO CACHE, FETCH REAL DATA (Server will not freeze)
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
        { $group: { _id: "$dateString", total: { $sum: "$totalNumbers" }, success: { $sum: "$successOTP" }, failed: { $sum: "$failedNumbers" }, amount: { $sum: { $add: ["$totalCost", "$totalCommission"] } } } }
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    dailyStatsAgg.forEach((ds: any) => {
        groupedRawData[ds._id] = { total: ds.total || 0, success: ds.success || 0, failed: ds.failed || 0, amount: ds.amount || 0 };
    });

    groupedRawData[todayStrUTC] = { total: 0, success: 0, failed: 0, amount: 0 };

    const ordersCursor = Order.find({ dateString: todayStrUTC })
        .select("status createdAt updatedAt fullMessage orderCost orderCommission")
        .lean()
        .cursor();

    let counter = 0;
    for await (const o of ordersCursor) {
        counter++;
        if (counter % 500 === 0) await releaseThread(); // Prevents Server Crash!

        const currentStatus = (o.status || "").toUpperCase(); 
        groupedRawData[todayStrUTC].total += 1;

        if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
            const msgArray = o.fullMessage ? o.fullMessage.split(/_\|\|_/) : [];
            let finalValidCount = 0;
            msgArray.forEach((m: string) => { if (m.trim() !== "" && !m.toLowerCase().includes("waiting")) finalValidCount += 1; });
            if (finalValidCount === 0) finalValidCount = 1;

            groupedRawData[todayStrUTC].success += finalValidCount;
            groupedRawData[todayStrUTC].amount += ((o.orderCost || 0) + (o.orderCommission || 0));

            const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
            const bIdx = Math.floor(hour / 4);
            if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += finalValidCount;

            let sName = extractServiceName(o.fullMessage);
            todayAppCounts[sName] = (todayAppCounts[sName] || 0) + finalValidCount;
        } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING"].includes(currentStatus)) {
            groupedRawData[todayStrUTC].failed += 1;
        }
    }

    const yesterdayDate = new Date(); yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    const responsePayload = {
        success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
        serverDate: todayStrUTC, todaySuccess: todayData.success, todaySpend: todayData.amount, 
        yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    };

    // Save to Redis for 2 minutes
    await redis.setex(cacheKey, 120, JSON.stringify(responsePayload));
    return NextResponse.json(responsePayload);

  } catch (error) { return NextResponse.json({ success: false }); }
}