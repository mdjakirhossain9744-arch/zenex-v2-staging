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
    const { email } = await req.json();
    const safeAgentEmail = email.toLowerCase().trim();

    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') }).lean();
    if (!agent) return NextResponse.json({ success: false, message: "Agent not found" });

    const emailConditions = [{ agentEmail: new RegExp(`^${agent.email}$`, 'i') }];
    if (agent.customAgentMail) emailConditions.push({ agentEmail: new RegExp(`^${agent.customAgentMail}$`, 'i') });

    const networkUsers = await User.find({ $or: emailConditions, role: "user" }).select("email otpRate").lean();

    const targetEmails = new Set<string>();
    const userRateMap: Record<string, number> = {};

    targetEmails.add(safeAgentEmail);
    if (agent.customAgentMail) targetEmails.add(agent.customAgentMail.toLowerCase().trim());
    userRateMap[safeAgentEmail] = agent.otpRate || 0.50;

    networkUsers.forEach((u: any) => {
        if (u.email) {
            const e = u.email.toLowerCase().trim();
            targetEmails.add(e);
            userRateMap[e] = u.otpRate || 0.50;
        }
    });

    const uniqueEmails = Array.from(targetEmails);
    const agentMaxRate = agent.agentMaxRate || 0.70;

    const queryConditions: any[] = [];
    uniqueEmails.forEach(e => {
        const regex = new RegExp(`^${e}$`, 'i');
        queryConditions.push({ userEmail: regex }, { email: regex });
    });

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const orders = await Order.find({ createdAt: { $gte: sixtyDaysAgo }, $or: queryConditions })
    .select("status createdAt updatedAt dateString fullMessage userEmail email")
    .lean(); 

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];
    const todayStrBD = getBDDateString(new Date());

    orders.forEach((o: any) => {
       let finalDateStr = "";
       // 💥 THE FIX: ওটিপি আসার সঠিক টাইম (updatedAt) ব্যবহার করা হলো 💥
       if ((o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") && o.updatedAt) {
           finalDateStr = getBDDateString(o.updatedAt);
       } else if (o.createdAt) {
           finalDateStr = getBDDateString(o.createdAt);
       } else if (o.dateString) {
           finalDateStr = getBDDateString(new Date(o.dateString));
       } else {
           finalDateStr = getBDDateString(new Date());
       }

       if (!groupedRawData[finalDateStr]) {
           groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       }
       
       // 💥 FIX 1: ১টা অর্ডার মানে ১টাই টোটাল নাম্বার 💥
       groupedRawData[finalDateStr].total += 1;
       groupedRawData[finalDateStr].allocation += 1;

       if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
          
          const msgLower = (o.fullMessage || "").toLowerCase();
          const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

          // 💥 FIX 2: ডুপ্লিকেট ফেক ওটিপিগুলো বাদ দিয়ে শুধু ইউনিক ওটিপি গোনা 💥
          const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
          const uniqueCodes = new Set();
          
          msgArray.forEach((msg: string) => {
              const match = msg.match(/\b\d{4,8}\b/);
              uniqueCodes.add(match ? match[0] : msg.trim());
          });
          
          const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

          groupedRawData[finalDateStr].success += validMsgCount;

          if (!isFreeService) {
              const uRate = userRateMap[(o.userEmail || o.email || "").toLowerCase().trim()] || 0.50;
              groupedRawData[finalDateStr].amount += Math.max(0, agentMaxRate - uRate) * validMsgCount;
          }

          if (finalDateStr === todayStrBD) {
              const hour = getBDHour(o.updatedAt || o.createdAt || new Date());
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
       userRate: agentMaxRate, balance: agent.agentEarning || 0, serverDate: todayStrBD
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}