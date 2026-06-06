export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";

const getUTCDateString = (dateObj: any = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateObj));
  } catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });

    await connectToDatabase();
    
    const body = await req.json();
    const { agentEmail, page = 1, limit = 40, search = "", status = "all" } = body; 

    const agent = await User.findOne({
      $or: [{ email: agentEmail }, { customAgentMail: agentEmail }],
      role: { $in: ["agent", "manager"] }
    });

    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    const agentMatch = { $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }] };
    const roleMatch = { role: "user" };

    let query: any = { $and: [agentMatch, roleMatch] };

    // 💥 ENHANCED SEARCH LOGIC: Supports Name, Email, and ZX- ID 💥
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const hexSearch = safeSearch.replace(/^ZX-/i, ""); // Remove ZX- if typed
      
      let searchOr: any[] = [
         { fullName: { $regex: safeSearch, $options: "i" } }, 
         { email: { $regex: safeSearch, $options: "i" } },
         { zxId: { $regex: safeSearch, $options: "i" } } // If actually saved in DB
      ];

      // 💥 SUPER HACK: Search by generated ZX- ID (which is the end of _id) 💥
      if (hexSearch.length > 0) {
         searchOr.push({
           $expr: {
             $regexMatch: { input: { $toString: "$_id" }, regex: hexSearch, options: "i" }
           }
         });
      }

      query.$and.push({ $or: searchOr });
    }

    if (status && status !== "all") {
      query.$and.push({ status: status });
    }

    const skip = (page - 1) * limit;

    // 💥 1. PARALLEL EXECUTION: Running Count and Find together (Speed Boost) 💥
    const [filteredTotal, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
    ]);

    const userEmails = users.map(u => (u.email || "").toLowerCase().trim());
    const todayStr = getUTCDateString(); 
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const orders = await Order.find({
        createdAt: { $gte: twoDaysAgo },
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        $or: [ { userEmail: { $in: userEmails } }, { email: { $in: userEmails } } ]
    }).select("userEmail email createdAt updatedAt dateString fullMessage").lean();

    const otpCounts: Record<string, number> = {};
    
    orders.forEach((o: any) => {
        const finalDateStr = o.updatedAt 
            ? getUTCDateString(o.updatedAt) 
            : (o.createdAt ? getUTCDateString(o.createdAt) : (o.dateString ? getUTCDateString(new Date(o.dateString)) : getUTCDateString(new Date())));
        
        if (finalDateStr === todayStr) {
            const e = (o.userEmail || o.email || "").toLowerCase().trim();
            const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
            const uniqueCodes = new Set();
            msgArray.forEach((msg: string) => {
                const match = msg.match(/\b\d{4,8}\b/);
                uniqueCodes.add(match ? match[0] : msg.trim());
            });
            const msgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;
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

    // 💥 2. PARALLEL EXECUTION FOR STATS: 4 Queries running at once! 💥
    const globalQuery = { $and: [agentMatch, roleMatch] };
    
    const [globalTotal, activeUsers, pendingUsers, bannedUsers] = await Promise.all([
        User.countDocuments(globalQuery),
        User.countDocuments({ ...globalQuery, status: "active" }),
        User.countDocuments({ ...globalQuery, status: "pending" }),
        User.countDocuments({ ...globalQuery, status: "banned" })
    ]);

    return NextResponse.json({ 
        users: formattedUsers,
        pagination: { total: filteredTotal, page, limit, totalPages: Math.ceil(filteredTotal / limit) || 1 },
        stats: { activeUsers, pendingUsers, bannedUsers, globalTotal },
        maxLimit: agent.agentMaxUsers || 100,
        agentRate: agent.otpRate || 0
    }, { status: 200 });

  } catch (error: any) { return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); }
}