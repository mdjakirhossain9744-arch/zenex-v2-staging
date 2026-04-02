export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";

export async function GET(req: NextRequest) {
  try {
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

    const agents = await User.find({ role: "agent" });
    const agentStats: Record<string, any> = {};
    
    agents.forEach(a => {
        const safeEmail = a.email.toLowerCase().trim();
        agentStats[safeEmail] = {
            name: a.fullName,
            email: safeEmail,
            customMail: (a.customAgentMail || "").toLowerCase().trim(),
            agentRate: Number(a.agentMaxRate || 0.70),
            thisMonthOTPs: 0,
            thisMonthCommission: 0 // এজেন্টের ইনকাম
        };
    });

    const users = await User.find({ role: "user", agentEmail: { $ne: null } });
    const userToAgentMap: Record<string, { agentEmail: string, userRate: number }> = {};
    
    users.forEach(u => {
        const uEmail = u.email.toLowerCase().trim();
        const aEmail = (u.agentEmail || "").toLowerCase().trim();
        userToAgentMap[uEmail] = {
            agentEmail: aEmail,
            userRate: Number(u.otpRate || 0.50)
        };
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1); 
    
    const orders = await Order.find({ 
        createdAt: { $gte: startOfMonth },
        status: "DONE" 
    }).select("userEmail fullMessage");

    orders.forEach(o => {
        const uEmail = (o.userEmail || "").toLowerCase().trim();
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
                
                if (!isFreeService) {
                    const commissionPerOtp = Math.max(0, targetAgent.agentRate - userToAgentMap[uEmail].userRate);
                    targetAgent.thisMonthCommission += (commissionPerOtp * msgCount);
                }
            }
        }
    });

    const finalReport = Object.values(agentStats)
        .sort((a, b) => b.thisMonthOTPs - a.thisMonthOTPs)
        .map(a => ({
            agentName: a.name,
            agentEmail: a.email,
            monthOTPs: a.thisMonthOTPs,
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