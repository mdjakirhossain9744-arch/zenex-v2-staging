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

// 💥 TIMEZONE FIX: Ensuring UTC consistency 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  try { 
      const d = new Date(dateObj);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  } 
  catch (e) { 
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
};

const getUTCHour = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).getUTCHours(); } 
  catch(e) { return 0; }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const { email, role, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    let userRate = role === "admin" ? 0 : (currentUser.otpRate || 0.50);
    let balance = role === "admin" ? 0 : (currentUser.balance || 0);
    let targetEmail = role === "admin" ? "" : safeEmail;

    // 💥 YESTERDAY CALCULATION FIX 💥
    const now = new Date();
    const todayStrUTC = getUTCDateString(now);
    
    const yesterdayDate = new Date(now);
    yesterdayDate.setUTCDate(now.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const isAllTime = limitDays === "all";

    // 💥 THE MIDNIGHT CROSSOVER FIX (Smart Live Boundary) 💥
    let liveQueryDateStr = todayStrUTC;
    let liveQueryStart = new Date(todayStrUTC + "T00:00:00.000Z");

    const currentUTCHour = now.getUTCHours();
    const currentUTCMin = now.getUTCMinutes();
    
    // রাত ০০:০০ থেকে ০০:৩৫ পর্যন্ত লাইভ কুয়েরি গতকাল থেকে শুরু হবে (কারণ ক্রন তখনো ডায়েরি লিখেনি)
    if (currentUTCHour === 0 && currentUTCMin <= 35) {
        liveQueryDateStr = yesterdayStrUTC;
        liveQueryStart = new Date(liveQueryDateStr + "T00:00:00.000Z");
    }
    
    // ডায়েরি শুধু লাইভ সীমানার আগের ডাটা আনবে (ডাবল কাউন্ট রোধ করার জন্য)
    const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr } };
    
    // 💥 Ensure yesterday is ALWAYS fetched regardless of limitDays 💥
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date(now);
        pastDaysLimit.setUTCDate(now.getUTCDate() - Math.max(limitNum, 2)); // 2 ensures yesterday is always included
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
    }

    if (role !== "admin") {
        dailyStatQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    }

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];
    
    const dailyStats = await DailyStat.find(dailyStatQuery).lean();

    dailyStats.forEach((ds: any) => {
        const dDate = ds.dateString;
        if (!groupedRawData[dDate]) groupedRawData[dDate] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };

        groupedRawData[dDate].total += (ds.totalNumbers || 0);
        groupedRawData[dDate].allocation += (ds.totalNumbers || 0);
        groupedRawData[dDate].success += (ds.successOTP || 0);
        groupedRawData[dDate].failed += (ds.failedNumbers || ds.failed || 0); 
        
        if (role === "admin") {
            groupedRawData[dDate].amount += ((ds.totalCost || 0) + (ds.totalCommission || 0));
        } else {
            groupedRawData[dDate].amount += (ds.totalCost || 0);
        }
    });

    // 💥 LIVE ORDERS FETCH 💥
    // To be 100% safe about yesterday, we also fetch yesterday's live orders if they exist
    const orderQuery: any = { createdAt: { $gte: new Date(yesterdayStrUTC + "T00:00:00.000Z") } }; 
    
    if (role !== "admin") {
        orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    }

    const orders = await Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage userEmail orderCost orderCommission").lean();

    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 

       // 💥 DATE CONSISTENCY FIX: ওটিপি পরে আসলেও অর্ডারের মূল দিনের ঘরেই কাউন্ট হবে 💥
       const finalDateStr = o.dateString || getUTCDateString(o.createdAt);

       // We only want to process live orders that are NOT already in the diary
       // If the order's date is older than liveQueryDateStr, and it's NOT yesterday, skip it
       if (finalDateStr < liveQueryDateStr && finalDateStr !== yesterdayStrUTC) return;

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       
       groupedRawData[finalDateStr].total += 1; 
       groupedRawData[finalDateStr].allocation += 1;

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
          const uniqueCodes = new Set();
          msgArray.forEach((msg: string) => {
              const match = msg.match(/\b\d{4,8}\b/);
              uniqueCodes.add(match ? match[0] : msg.trim());
          });
          const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

          groupedRawData[finalDateStr].success += validMsgCount;
          
          if (role === "admin") {
              groupedRawData[finalDateStr].amount += ((o.orderCost || 0) + (o.orderCommission || 0));
          } else {
              groupedRawData[finalDateStr].amount += (o.orderCost || 0);
          }

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += validMsgCount;

              let sName = extractServiceName(o.fullMessage);
              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += validMsgCount;
          }
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrUTC,
       todaySuccess: todayData.success, todaySpend: todayData.amount, 
       yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount // 💥 YESTERDAY FIX APPLIED 💥
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}