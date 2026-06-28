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
    if (lowerMsg.includes('microsoft') || lowerMsg.includes('outlook')) return 'Microsoft';
    if (lowerMsg.includes('amazon') || lowerMsg.includes('aws')) return 'Amazon';
    if (lowerMsg.includes('netflix')) return 'Netflix';
    if (lowerMsg.includes('paypal')) return 'PayPal';
    if (lowerMsg.includes('tiktok')) return 'TikTok';
    if (lowerMsg.includes('tinder')) return 'Tinder';
    if (lowerMsg.includes('uber')) return 'Uber';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    return "Other"; 
};

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const getUTCHour = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).getUTCHours(); } 
  catch(e) { return 0; }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();

    // 💥 FIX 1: FIRE-AND-FORGET INDEXING (Prevents White Screen & Server Freeze) 💥
    if (Order.collection && DailyStat.collection) {
        Promise.all([
            Order.collection.createIndex({ dateString: -1, userEmail: 1 }).catch(() => {}),
            DailyStat.collection.createIndex({ dateString: -1, userEmail: 1 }).catch(() => {})
        ]).catch(() => {});
    }
    
    const { email, role, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    const exactDbEmail = currentUser.email; 
    let userRate = role === "admin" ? 0 : (currentUser.otpRate || 0);
    let balance = role === "admin" ? 0 : (currentUser.balance || 0);
    
    const todayStrUTC = getUTCDateString(new Date());
    const isAllTime = limitDays === "all";

    // 💥 SMART LIVE BOUNDARY 💥
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

    if (role !== "admin") {
        dailyStatQuery.userEmail = exactDbEmail; 
    }

    const orderQuery: any = { dateString: { $gte: liveQueryDateStr } }; 
    if (role !== "admin") {
        orderQuery.userEmail = exactDbEmail; 
    }

    // 💥 PARALLEL EXECUTION: Running Aggregation and Live Orders query at the same time! 💥
    const [dailyStatsAgg, orders] = await Promise.all([
        DailyStat.aggregate([
            { $match: dailyStatQuery },
            { $group: {
                _id: "$dateString",
                total: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                success: { $sum: { $ifNull: ["$successOTP", 0] } },
                failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } },
                amount: { 
                    $sum: role === "admin" 
                        ? { $add: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalCommission", 0] }] } 
                        : { $ifNull: ["$totalCost", 0] } 
                }
            }}
        ]),
        Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage userEmail orderCost orderCommission").lean()
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    dailyStatsAgg.forEach((ds: any) => {
        groupedRawData[ds._id] = {
            total: ds.total, allocation: ds.allocation,
            success: ds.success, failed: ds.failed, amount: ds.amount
        };
    });

    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 
       const finalDateStr = o.dateString || getUTCDateString(o.createdAt);

       if (finalDateStr < liveQueryDateStr) return; 

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       
       groupedRawData[finalDateStr].total += 1; 
       groupedRawData[finalDateStr].allocation += 1;

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          
          // 💥 FIX 2: BULLETPROOF MULTI-OTP COUNTING MATCHED WITH SERVER.JS PAYOUT 💥
          const msgArray = o.fullMessage ? o.fullMessage.split(/_\|\|_/) : [];
          let finalValidCount = 0;
          
          msgArray.forEach((m: string) => {
              const cleanMsg = m.trim().toLowerCase();
              // Do not count empty spaces or "waiting..." as an OTP
              if (cleanMsg !== "" && !cleanMsg.includes("waiting")) {
                  finalValidCount += 1;
              }
          });

          // Fallback safeguard: If status is DONE but message was somehow empty, count as at least 1
          if (finalValidCount === 0) finalValidCount = 1;

          groupedRawData[finalDateStr].success += finalValidCount;
          
          if (role === "admin") {
              // 💥 FINANCIAL MATCH: Exact cost and commission saved in DB 💥
              groupedRawData[finalDateStr].amount += ((o.orderCost || 0) + (o.orderCommission || 0));
          } else {
              groupedRawData[finalDateStr].amount += (o.orderCost || 0);
          }

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += finalValidCount;

              let sName = extractServiceName(o.fullMessage);
              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += finalValidCount;
          }
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrUTC,
       todaySuccess: todayData.success, todaySpend: todayData.amount, 
       yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    });

  } catch (error) { 
      return NextResponse.json({ success: false }); 
  }
}