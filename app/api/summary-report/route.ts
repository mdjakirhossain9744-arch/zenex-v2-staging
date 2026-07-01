import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const { email, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    const exactDbEmail = currentUser.email; 
    let userRate = currentUser.otpRate || 0;
    let balance = currentUser.balance || 0;
    
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
    
    const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr }, userEmail: exactDbEmail };
    
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
    }

    const orderQuery: any = { dateString: { $gte: liveQueryDateStr }, userEmail: exactDbEmail }; 

    // 💥 USER MATH: Cost Only (No Commission) + processedKeys injected 💥
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
        Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage orderCost processedKeys").lean()
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
        groupedRawData[ds._id] = { total: finalTotal, allocation: finalTotal, success: ds.success, failed: ds.failed, amount: ds.amount };
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
          groupedRawData[finalDateStr].amount += (o.orderCost || 0); // User only sees their earnings

          if (finalDateStr === todayStrUTC) {
              const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

              let sName = extractServiceName(o.fullMessage);
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
       todaySuccess: todayData.success, todaySpend: todayData.amount, // Note: Variable kept 'todaySpend' for UI compatibility, but represents User Earnings
       yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}