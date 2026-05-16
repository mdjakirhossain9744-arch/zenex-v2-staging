import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

// 💥 UPDATE: UTC Date format 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

// 💥 UPDATE: UTC Hour logic for Traffic Chart 💥
const getUTCHour = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).getUTCHours(); } 
  catch(e) { return 0; }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, role } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    let userRate = 0.50, balance = 0, targetEmail = "";
    let userToAdminCostMap: Record<string, number> = {};

    if (role === "admin") { 
        userRate = 0; 
        const allUsers = await User.find({}).select("email agentEmail role agentMaxRate customAgentMail").lean();
        const agentRates: Record<string, number> = {};
        
        allUsers.forEach((u: any) => {
            if (u.role === "agent") {
                const rate = u.agentMaxRate || 0;
                if (u.email) agentRates[u.email.toLowerCase().trim()] = rate;
                if (u.customAgentMail) agentRates[u.customAgentMail.toLowerCase().trim()] = rate;
            }
        });

        allUsers.forEach((u: any) => {
            if (u.email) {
                const emailKey = u.email.toLowerCase().trim();
                if (u.role === "agent") userToAdminCostMap[emailKey] = agentRates[emailKey] || 0;
                else if (u.role === "user" && u.agentEmail) {
                    const aEmail = u.agentEmail.toLowerCase().trim();
                    userToAdminCostMap[emailKey] = agentRates[aEmail] || 0;
                }
            }
        });
    } else { 
        userRate = currentUser.otpRate || 0.50; 
        balance = currentUser.balance || 0; 
        targetEmail = safeEmail; 
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

    const todayStrUTC = getUTCDateString(new Date());
    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    const dailyStatQuery: any = { dateString: { $gte: getUTCDateString(sixtyDaysAgo) } };
    if (role !== "admin") dailyStatQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    
    const dailyStats = await DailyStat.find(dailyStatQuery).lean();
    const archivedKeys = new Set<string>();

    dailyStats.forEach((ds: any) => {
        const dDate = ds.dateString;
        const dEmail = (ds.userEmail || "").toLowerCase().trim();
        
        archivedKeys.add(`${dDate}_${dEmail}`);

        if (!groupedRawData[dDate]) groupedRawData[dDate] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };

        groupedRawData[dDate].total += (ds.totalNumbers || 0);
        groupedRawData[dDate].allocation += (ds.totalNumbers || 0);
        groupedRawData[dDate].success += (ds.successOTP || 0);
        groupedRawData[dDate].failed += (ds.failedNumbers || 0);

        let orderCostRate = userRate;
        if (role === "admin") orderCostRate = userToAdminCostMap[dEmail] || 0;
        
        groupedRawData[dDate].amount += (orderCostRate * (ds.successOTP || 0));
    });

    const orderQuery: any = { createdAt: { $gte: sixtyDaysAgo } };
    if (role !== "admin") orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');

    const orders = await Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage userEmail").lean();

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
           finalDateStr = getUTCDateString(new Date());
       }

       const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       if (finalDateStr !== todayStrUTC && archivedKeys.has(`${finalDateStr}_${uEmail}`)) {
           return; 
       }

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       
       const msgLower = (o.fullMessage || "").toLowerCase();
       const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

       groupedRawData[finalDateStr].total += 1; 
       groupedRawData[finalDateStr].allocation += 1;

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          
          const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
          const uniqueCodes = new Set();
          
          msgArray.forEach((msg: string) => {
              const match = msg.match(/\b\d{4,8}\b/);
              const extractedCode = match ? match[0] : msg.trim();
              uniqueCodes.add(extractedCode);
          });
          
          const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

          groupedRawData[finalDateStr].success += validMsgCount;

          let orderCostRate = userRate;
          if (role === "admin") orderCostRate = userToAdminCostMap[uEmail] || 0;

          if (!isFreeService) {
              groupedRawData[finalDateStr].amount += (orderCostRate * validMsgCount);
          }

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += validMsgCount;

              let sName = "Other Network";
              if (msgLower.includes("facebook") || msgLower.includes("fb")) sName = "Facebook";
              else if (msgLower.includes("whatsapp") || msgLower.includes("wa")) sName = "WhatsApp";
              else if (msgLower.includes("instagram") || msgLower.includes("ig")) sName = "Instagram";
              else if (msgLower.includes("telegram") || msgLower.includes("tg")) sName = "Telegram";
              else if (msgLower.includes("google") || msgLower.includes("gmail")) sName = "Google";
              else if (msgLower.includes("tiktok") || msgLower.includes("tt")) sName = "TikTok";
              else if (msgLower.includes("apple") || msgLower.includes("ap")) sName = "Apple";

              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += validMsgCount;
          }
       } else if (currentStatus === "FAILED" || currentStatus === "CANCELLED" || currentStatus === "CANCELED" || currentStatus === "TIMEOUT" || currentStatus === "ERROR") {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    // 💥 Get Today and Yesterday Dates in UTC 💥
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const todayData = groupedRawData[todayStrUTC] || { success: 0, amount: 0 };
    const yesterdayData = groupedRawData[yesterdayStrUTC] || { success: 0, amount: 0 };

    return NextResponse.json({
       success: true, 
       groupedRawData, 
       todayAppCounts, 
       todayHourlyTraffic,
       userRate, 
       balance, 
       serverDate: todayStrUTC,
       // 🔥 Added for 4 Cards 🔥
       todaySuccess: todayData.success,
       todaySpend: todayData.amount, 
       yesterdaySuccess: yesterdayData.success,
       yesterdaySpend: yesterdayData.amount
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}