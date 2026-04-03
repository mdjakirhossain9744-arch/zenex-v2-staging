import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order"; 

export const dynamic = "force-dynamic";

const getBDDateString = (dateObj: any = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(dateObj));
  } catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(req: Request) {
  try {
    const { agentEmail } = await req.json();
    if (!agentEmail) return NextResponse.json({ message: "Agent email required" }, { status: 400 });

    await connectToDatabase();
    const safeAgentEmail = agentEmail.toLowerCase().trim();

    const agent = await User.findOne({ 
      $or: [ { email: new RegExp(`^${safeAgentEmail}$`, 'i') }, { customAgentMail: new RegExp(`^${safeAgentEmail}$`, 'i') } ],
      role: "agent" 
    }).lean();

    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    const emailConditions = [{ agentEmail: new RegExp(`^${agent.email}$`, 'i') }];
    if (agent.customAgentMail) emailConditions.push({ agentEmail: new RegExp(`^${agent.customAgentMail}$`, 'i') });

    const users = await User.find({ $or: emailConditions, role: "user" }).select("-password").sort({ createdAt: -1 }).lean();

    // 💥 ROCKET SPEED: Fetch all orders ONCE and count Exact OTPs! 💥
    const todayStr = getBDDateString();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2); 

    const emails = users.map((u: any) => (u.email || "").toLowerCase().trim());

    const orders = await Order.find({
        createdAt: { $gte: twoDaysAgo },
        userEmail: { $in: emails.map(e => new RegExp(`^${e}$`, 'i')) },
        status: { $in: ["DONE", "Success", "SUCCESS"] }
    }).select("userEmail email createdAt dateString fullMessage").lean();

    const otpCounts: Record<string, number> = {};
    
    orders.forEach((o: any) => {
        const finalDateStr = o.createdAt ? getBDDateString(o.createdAt) : (o.dateString ? getBDDateString(new Date(o.dateString)) : getBDDateString(new Date()));
        
        if (finalDateStr === todayStr) {
            const e = (o.userEmail || o.email || "").toLowerCase().trim();
            // 💥 EXACT LOGIC: 1 Orders e 3 SMS asle 3 ta count hobe! 💥
            const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
            otpCounts[e] = (otpCounts[e] || 0) + msgCount;
        }
    });

    const formattedUsers = users.map((u: any) => {
      const uEmail = (u.email || "").toLowerCase().trim();
      const todayOtpCount = otpCounts[uEmail] || 0; 

      let finalStatus = "Pending";
      if (u.status) finalStatus = u.status.toLowerCase() === 'active' ? 'Active' : u.status.toLowerCase() === 'banned' ? 'Banned' : 'Pending';

      return {
        id: u._id,
        uid: u._id ? `ZX-${u._id.toString().substring(18, 24).toUpperCase()}` : "ZX-UNKNOWN",
        name: u.fullName || "Unknown User",
        email: u.email || "No Email",
        balance: Number(u.balance || 0).toFixed(2),
        status: finalStatus,
        todayOTP: todayOtpCount, // 💥 Now matches dashboard 100%
        rate: Number(u.otpRate || 0.50).toFixed(2),
        isApiActive: u.isApiActive || false 
      };
    });

    return NextResponse.json({ 
      users: formattedUsers, 
      maxLimit: agent.agentMaxUsers || 100, 
      agentRevenue: Number(agent.agentEarning || 0).toFixed(2),
      agentRate: Number(agent.agentMaxRate || 0.70).toFixed(2)
    }, { status: 200 });

  } catch (error: any) { return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); }
}