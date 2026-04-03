import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

const getBDDateString = (dateObj: any = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(dateObj));
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email } = await req.json();
    const safeAgentEmail = email.toLowerCase().trim();

    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') }).lean();
    if (!agent) return NextResponse.json({ success: false, message: "Agent not found" });

    const emailConditions = [{ agentEmail: new RegExp(`^${agent.email}$`, 'i') }];
    if (agent.customAgentMail) {
      emailConditions.push({ agentEmail: new RegExp(`^${agent.customAgentMail}$`, 'i') });
    }

    const networkUsers = await User.find({
        $or: emailConditions,
        role: "user"
    }).select("email otpRate").lean();

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
        queryConditions.push({ userEmail: regex });
        queryConditions.push({ email: regex });
    });

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 🚀 ROCKET SPEED FIX: .select() + .lean() applied 🚀
    const orders = await Order.find({ 
        createdAt: { $gte: sixtyDaysAgo }, 
        $or: queryConditions 
    })
    .select("status createdAt dateString fullMessage userEmail email")
    .lean(); 

    const groupedRawData: Record<string, any> = {};

    orders.forEach((o: any) => {
       const oEmail = (o.userEmail || o.email || "").toLowerCase().trim();
       
       let finalDateStr = "";
       if (o.createdAt) {
           finalDateStr = getBDDateString(o.createdAt);
       } else if (o.dateString) {
           let d = new Date(o.dateString);
           if (isNaN(d.getTime())) d = new Date();
           finalDateStr = getBDDateString(d);
       } else {
           finalDateStr = getBDDateString(new Date());
       }

       if (!groupedRawData[finalDateStr]) {
           // 💥 Data separation perfectly aligned with frontend 💥
           groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       }
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[finalDateStr].total += msgCount; 
          groupedRawData[finalDateStr].allocation += msgCount; 
          groupedRawData[finalDateStr].success += msgCount;

          if (!isFreeService) {
              const uRate = userRateMap[oEmail] || 0.50;
              const commission = Math.max(0, agentMaxRate - uRate) * msgCount;
              groupedRawData[finalDateStr].amount += commission;
          }
       } else {
          groupedRawData[finalDateStr].total += 1;
          groupedRawData[finalDateStr].allocation += 1;
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    return NextResponse.json({
       success: true,
       groupedRawData,
       userRate: agentMaxRate, 
       balance: agent.agentEarning || 0, 
       serverDate: getBDDateString(new Date())
    });

  } catch (error) {
     console.error("Agent Summary Error:", error);
     return NextResponse.json({ success: false });
  }
}