export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";

const getBDDateString = (dateObj: any = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateObj));
  } catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });

    await connectToDatabase();
    
    const body = await req.json();
    const { agentEmail, page = 1, limit = 40, search = "" } = body; // 💥 Pagination & Search Params 💥

    const agent = await User.findOne({
      $or: [{ email: agentEmail }, { customAgentMail: agentEmail }],
      role: "agent"
    });

    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    // 💥 Smart Search Query 💥
    let query: any = {
      $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }],
      role: "user"
    };

    if (search) {
      query = {
        $and: [
          { $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }] },
          { role: "user" },
          { $or: [{ fullName: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
        ]
      };
    }

    const skip = (page - 1) * limit;
    const totalUsers = await User.countDocuments(query);
    
    // .lean() for blazing fast execution
    const users = await User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const userEmails = users.map(u => (u.email || "").toLowerCase().trim());
    const todayStr = getBDDateString();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const orders = await Order.find({
        createdAt: { $gte: twoDaysAgo },
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        $or: [ { userEmail: { $in: userEmails } }, { email: { $in: userEmails } } ]
    }).select("userEmail email createdAt dateString fullMessage").lean();

    const otpCounts: Record<string, number> = {};
    
    orders.forEach((o: any) => {
        const finalDateStr = o.createdAt ? getBDDateString(o.createdAt) : (o.dateString ? getBDDateString(new Date(o.dateString)) : getBDDateString(new Date()));
        if (finalDateStr === todayStr) {
            const e = (o.userEmail || o.email || "").toLowerCase().trim();
            const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
            otpCounts[e] = (otpCounts[e] || 0) + msgCount;
        }
    });

    const formattedUsers = users.map((u: any) => {
      const uEmail = (u.email || "").toLowerCase().trim();
      const todayOtpCount = otpCounts[uEmail] || 0;

      return {
        id: u._id,
        uid: u._id ? `ZX-${u._id.toString().substring(18, 24).toUpperCase()}` : "ZX-UNKNOWN",
        name: u.fullName,
        email: u.email,
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        balance: Number(u.balance || 0).toFixed(2),
        todayOTP: todayOtpCount, 
        rate: (u.otpRate !== undefined && u.otpRate !== null) ? Number(u.otpRate).toFixed(2) : "0.00"
      };
    });

    const activeUsers = await User.countDocuments({ ...query, status: "active" });
    const pendingUsers = await User.countDocuments({ ...query, status: "pending" });
    const bannedUsers = await User.countDocuments({ ...query, status: "banned" });

    return NextResponse.json({ 
        users: formattedUsers,
        pagination: { total: totalUsers, page, limit, totalPages: Math.ceil(totalUsers / limit) || 1 },
        stats: { activeUsers, pendingUsers, bannedUsers },
        maxLimit: agent.agentMaxUsers || 100,
        agentRate: agent.otpRate || 0
    }, { status: 200 });

  } catch (error: any) { return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); }
}