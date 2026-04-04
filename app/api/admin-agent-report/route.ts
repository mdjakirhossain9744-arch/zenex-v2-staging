export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";
import DailyStat from "../../../models/DailyStat"; // 💥 ডায়েরি যুক্ত করা হলো

const getBDDateString = (dateObj: any = new Date()) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateObj)); } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function GET(req: NextRequest) {
  try {
    // 🛡️ ১. অরিজিনাল হ্যাকার প্রটেকশন (টোকেন চেক) 🛡️
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });

    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      if (decodedPayload.role !== "admin") {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Admins only!" }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token!" }, { status: 403 });
    }

    await connectToDatabase();

    // 👨‍💼 ২. এজেন্ট এবং ইউজারদের ডাটাবেস সেটআপ 👨‍💼
    const agents = await User.find({ role: "agent" }).lean();
    const agentStats: Record<string, any> = {};
    
    agents.forEach((a: any) => {
        const safeEmail = (a.email || "").toLowerCase().trim();
        agentStats[safeEmail] = {
            name: a.fullName,
            email: safeEmail,
            customMail: (a.customAgentMail || "").toLowerCase().trim(),
            agentRate: Number(a.agentMaxRate || 0.70),
            thisMonthOTPs: 0,
            todayOTPs: 0, // 💥 নতুন: আজকের OTP 💥
            thisMonthCommission: 0 
        };
    });

    const users = await User.find({ role: "user", agentEmail: { $ne: null } }).lean();
    const userToAgentMap: Record<string, { agentEmail: string, userRate: number }> = {};
    
    users.forEach((u: any) => {
        const uEmail = (u.email || "").toLowerCase().trim();
        const aEmail = (u.agentEmail || "").toLowerCase().trim();
        userToAgentMap[uEmail] = {
            agentEmail: aEmail,
            userRate: Number(u.otpRate || 0.50)
        };
    });

    const now = new Date();
    const todayStrBD = getBDDateString(now);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); 

    // 💾 ৩. ম্যাজিক: ডাটা মুছে গেলেও হিসাব ঠিক রাখার জন্য DailyStat থেকে ডাটা আনা 💾
    const dailyStats = await DailyStat.find({ dateString: { $gte: getBDDateString(startOfMonth) } }).lean();
    const archivedKeys = new Set<string>();

    dailyStats.forEach((ds: any) => {
        const dDate = ds.dateString;
        const uEmail = (ds.userEmail || "").toLowerCase().trim();
        archivedKeys.add(`${dDate}_${uEmail}`);

        if (ds.successOTP > 0 && userToAgentMap[uEmail]) {
            let aEmail = userToAgentMap[uEmail].agentEmail;
            
            let targetAgent = agentStats[aEmail];
            if (!targetAgent) targetAgent = Object.values(agentStats).find(a => a.customMail === aEmail);

            if (targetAgent) {
                targetAgent.thisMonthOTPs += ds.successOTP;
                if (dDate === todayStrBD) targetAgent.todayOTPs += ds.successOTP;
                
                const commissionPerOtp = Math.max(0, targetAgent.agentRate - userToAgentMap[uEmail].userRate);
                targetAgent.thisMonthCommission += (commissionPerOtp * ds.successOTP);
            }
        }
    });

    // ⚡ ৪. অরিজিনাল লজিক: মেইন Order থেকে লাইভ ডাটা আনা (ফ্রি সার্ভিস চেকসহ) ⚡
    const orders = await Order.find({ 
        createdAt: { $gte: startOfMonth },
        status: { $in: ["DONE", "Success", "SUCCESS"] }
    }).select("userEmail fullMessage createdAt dateString").lean();

    orders.forEach((o: any) => {
        const oDate = getBDDateString(o.createdAt || new Date(o.dateString));
        const uEmail = (o.userEmail || "").toLowerCase().trim();
        
        // 🛡️ ANTI-DOUBLE COUNT: যদি ডায়েরিতে হিসাব গোনা হয়ে থাকে তবে আর গুনবে না!
        if (oDate !== todayStrBD && archivedKeys.has(`${oDate}_${uEmail}`)) return;

        const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1; 
        const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

        if (userToAgentMap[uEmail]) {
            let aEmail = userToAgentMap[uEmail].agentEmail;
            
            let targetAgent = agentStats[aEmail];
            if (!targetAgent) {
                const matchedByCustom = Object.values(agentStats).find(a => a.customMail === aEmail);
                if (matchedByCustom) targetAgent = matchedByCustom;
            }

            if (targetAgent) {
                targetAgent.thisMonthOTPs += msgCount;
                if (oDate === todayStrBD) targetAgent.todayOTPs += msgCount; // 💥 আজকের লাইভ OTP 💥
                
                // 💥 আপনার অরিজিনাল লজিক: ফ্রি সার্ভিসে কোনো কমিশন নেই 💥
                if (!isFreeService) {
                    const commissionPerOtp = Math.max(0, targetAgent.agentRate - userToAgentMap[uEmail].userRate);
                    targetAgent.thisMonthCommission += (commissionPerOtp * msgCount);
                }
            }
        }
    });

    // 🏆 ৫. ফাইনাল রিপোর্ট তৈরি (র‍্যাঙ্কিং অনুযায়ী) 🏆
    const finalReport = Object.values(agentStats)
        .sort((a, b) => b.thisMonthOTPs - a.thisMonthOTPs)
        .map(a => ({
            agentName: a.name,
            agentEmail: a.email,
            monthOTPs: a.thisMonthOTPs,
            todayOTPs: a.todayOTPs, // 💥 ফ্রন্টএন্ডে আজকের ডাটা পাঠানো হলো
            agentEarnings: Number(a.thisMonthCommission).toFixed(2) 
        }));

    return NextResponse.json({ 
        success: true, 
        currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric' }), 
        report: finalReport 
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}