import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

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
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const todayStrBD = getBDDateString(new Date());
    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    // 💥 ম্যাজিক ১: DailyStat থেকে আর্কাইভ ডাটা ফেচ করা 💥
    const dailyStatQuery: any = { dateString: { $gte: getBDDateString(sixtyDaysAgo) } };
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
        
        // আর্কাইভ ডাটায় ফ্রী সার্ভিস চেক করা যায় না, তাই ডায়েরি যা বলছে তাই ভরসা
        groupedRawData[dDate].amount += (orderCostRate * (ds.successOTP || 0));
    });

    // 💥 ম্যাজিক ২: মেইন Order ডাটাবেস থেকে ডাটা ফেচ করা 💥
    const orderQuery: any = { createdAt: { $gte: sixtyDaysAgo } };
    if (role !== "admin") orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');

    const orders = await Order.find(orderQuery).select("status dateString createdAt fullMessage userEmail").lean();

    orders.forEach((o: any) => {
       let finalDateStr = "";
       if (o.createdAt) finalDateStr = getBDDateString(o.createdAt);
       else if (o.dateString) finalDateStr = getBDDateString(new Date(o.dateString));
       else finalDateStr = getBDDateString(new Date());

       const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       // 🛡️ ANTI-DOUBLE COUNT: ডায়েরিতে থাকলে স্কিপ করো
       if (finalDateStr !== todayStrBD && archivedKeys.has(`${finalDateStr}_${uEmail}`)) {
           return; 
       }

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       
       const msgLower = (o.fullMessage || "").toLowerCase();
       const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

       // 💥 FIX 1: Total Number Got সবসময় ১ হবে। যতোই ওটিপি আসুক, নাম্বার তো একটাই! 💥
       groupedRawData[finalDateStr].total += 1; 
       groupedRawData[finalDateStr].allocation += 1;

       if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
          
          // 💥 FIX 2: Strict Deduplication (ফেক বা স্প্যাম ওটিপিগুলো বাদ দিয়ে শুধু রিয়েল ওটিপি গোনা) 💥
          const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
          const uniqueCodes = new Set();
          
          msgArray.forEach((msg: string) => {
              const match = msg.match(/\b\d{4,8}\b/);
              const extractedCode = match ? match[0] : msg.trim();
              uniqueCodes.add(extractedCode);
          });
          
          const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

          // সাকসেস கவுন্ট হবে রিয়েল ইউনিক ওটিপির সমান
          groupedRawData[finalDateStr].success += validMsgCount;

          let orderCostRate = userRate;
          if (role === "admin") orderCostRate = userToAdminCostMap[uEmail] || 0;

          // 💥 FIX 3: ফ্রী সার্ভিস হলে ১ টাকাও Payout অ্যাড হবে না 💥
          if (!isFreeService) {
              groupedRawData[finalDateStr].amount += (orderCostRate * validMsgCount);
          }

          // ট্রাফিক এবং অ্যাপ চার্ট
          if (finalDateStr === todayStrBD) {
              const hour = getBDHour(o.createdAt || new Date());
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
       } else {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrBD 
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}