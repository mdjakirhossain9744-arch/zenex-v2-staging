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
    if (lowerMsg.includes('snapchat')) return 'Snapchat';
    if (lowerMsg.includes('discord')) return 'Discord';
    if (lowerMsg.includes('airbnb')) return 'Airbnb';
    if (lowerMsg.includes('line')) return 'LINE';
    if (lowerMsg.includes('wechat')) return 'WeChat';
    if (lowerMsg.includes('apple')) return 'Apple';
    if (lowerMsg.includes('viber')) return 'Viber';
    if (lowerMsg.includes('foodpanda')) return 'FoodPanda';
    if (lowerMsg.includes('imo')) return 'Imo';

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
    
    const { email, role, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    let userRate = role === "admin" ? 0 : (currentUser.otpRate || 0.50);
    let balance = role === "admin" ? 0 : (currentUser.balance || 0);
    let targetEmail = role === "admin" ? "" : safeEmail;

    const todayStrUTC = getUTCDateString(new Date());
    const isAllTime = limitDays === "all";
    
    // 💥 STRICT PAST DATA ONLY (Diary থেকে আজকের ডাটা খুঁজবে না) 💥
    const dailyStatQuery: any = { dateString: { $lt: todayStrUTC } };
    
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: todayStrUTC };
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
        groupedRawData[dDate].amount += (ds.totalCost || 0);
    });

    // 💥 STRICT TODAY DATA ONLY (Live Order থেকে শুধুমাত্র আজকের ডাটা খুঁজবে) 💥
    const orderQuery: any = {};
    const todayMidnight = new Date(todayStrUTC + "T00:00:00.000Z"); 
    orderQuery.createdAt = { $gte: todayMidnight }; 
    
    if (role !== "admin") {
        orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    }

    const orders = await Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage userEmail orderCost").lean();

    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 

       let finalDateStr = "";
       if ((currentStatus === "DONE" || currentStatus === "SUCCESS") && o.updatedAt) {
           finalDateStr = getUTCDateString(o.updatedAt);
       } else if (o.createdAt) {
           finalDateStr = getUTCDateString(o.createdAt);
       } else if (o.dateString) {
           finalDateStr = getUTCDateString(new Date(o.dateString));
       } else {
           finalDateStr = todayStrUTC;
       }

       if (finalDateStr !== todayStrUTC) return; 

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
          groupedRawData[finalDateStr].amount += (o.orderCost || 0);

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

  } catch (error) { return NextResponse.json({ success: false }); }
}