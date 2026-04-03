import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

const getBDDateString = (dateObj: any = new Date()) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateObj)); } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const getBDHour = (dateObj: any = new Date()) => {
  try {
    const hr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', hourCycle: 'h23' }).format(new Date(dateObj));
    return parseInt(hr, 10) || 0;
  } catch(e) { return 0; }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, role } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    let userRate = 0.50, balance = 0, targetEmail = "";
    if (role === "admin") { userRate = 0.50; } 
    else { userRate = currentUser.otpRate || 0.50; balance = currentUser.balance || 0; targetEmail = safeEmail; }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const orderQuery: any = { createdAt: { $gte: sixtyDaysAgo } };
    if (role !== "admin") orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');

    const orders = await Order.find(orderQuery).select("status dateString createdAt fullMessage userEmail").lean();

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];
    const todayStrBD = getBDDateString(new Date());

    orders.forEach((o: any) => {
       let finalDateStr = "";
       if (o.createdAt) finalDateStr = getBDDateString(o.createdAt);
       else if (o.dateString) finalDateStr = getBDDateString(new Date(o.dateString));
       else finalDateStr = getBDDateString(new Date());

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[finalDateStr].total += msgCount; 
          groupedRawData[finalDateStr].allocation += msgCount; 
          // 💥 এখানে সাকসেস যোগ হচ্ছে 💥
          groupedRawData[finalDateStr].success += msgCount;

          if (!isFreeService) groupedRawData[finalDateStr].amount += (userRate * msgCount);

          if (finalDateStr === todayStrBD) {
              const hour = getBDHour(o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += msgCount;

              let sName = "Other Network";
              const mLower = (o.fullMessage || "").toLowerCase();
              if (mLower.includes("facebook") || mLower.includes("fb")) sName = "Facebook";
              else if (mLower.includes("whatsapp") || mLower.includes("wa")) sName = "WhatsApp";
              else if (mLower.includes("instagram") || mLower.includes("ig")) sName = "Instagram";
              else if (mLower.includes("telegram") || mLower.includes("tg")) sName = "Telegram";
              else if (mLower.includes("google") || mLower.includes("gmail")) sName = "Google";
              else if (mLower.includes("tiktok") || mLower.includes("tt")) sName = "TikTok";
              else if (mLower.includes("apple") || mLower.includes("ap")) sName = "Apple";

              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              // 💥 ঠিক একই জায়গায় অ্যাপস কাউন্ট হচ্ছে (তাই যোগফল ১০০% মিলবে) 💥
              todayAppCounts[sName] += msgCount;
          }
       } else {
          groupedRawData[finalDateStr].total += 1;
          groupedRawData[finalDateStr].allocation += 1;
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrBD 
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}