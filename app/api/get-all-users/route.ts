export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";

// 🌍 UTC Timezone Converter
const getUTCDateString = (dateObj: any = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC', 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(dateObj));
  } catch (e) { 
    return new Date().toISOString().split('T')[0]; 
  }
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });

    try {
      const payloadBase64 = token.split('.')[1];
      const decodedString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const decodedPayload = JSON.parse(decodedString);
      
      if (decodedPayload.role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
    } catch (err) { return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 }); }

    await connectToDatabase();

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const rawSearchQuery = searchParams.get("search")?.trim() || "";
    
    // ফিল্টার প্যারামিটার
    const statusFilter = searchParams.get("status")?.trim().toLowerCase() || "all";
    const agentFilter = searchParams.get("agent")?.trim() || "all";

    let query: any = {};
    
    if (rawSearchQuery) {
        const safeSearch = rawSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
            { fullName: { $regex: safeSearch, $options: "i" } },
            { email: { $regex: safeSearch, $options: "i" } }
        ];
    }

    if (statusFilter && statusFilter !== "all") {
        query.status = statusFilter;
    }

    if (agentFilter && agentFilter !== "all") {
        query.agentEmail = agentFilter;
    }

    const skip = (page - 1) * limit;
    
    // 💥 1. PARALLEL EXECUTION: Count and Fetch running simultaneously (50% Faster) 💥
    const [totalUsersInQuery, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query)
          .select("-password")
          .sort({ role: 1, createdAt: -1 }) 
          .skip(skip)
          .limit(limit)
          .lean()
    ]);

    const userEmails = users.map(u => (u.email || "").toLowerCase().trim());
    const todayStr = getUTCDateString(); 
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const orders = await Order.find({
        createdAt: { $gte: twoDaysAgo },
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        $or: [
            { userEmail: { $in: userEmails } },
            { email: { $in: userEmails } }
        ]
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
        role: u.role,
        agentEmail: u.agentEmail || "Admin",
        balance: Number(u.balance || 0).toFixed(2),
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        todayOTP: todayOtpCount, 
        rate: (u.otpRate !== undefined && u.otpRate !== null) ? Number(u.otpRate).toFixed(2) : "0.00",
        customAgentMail: u.customAgentMail || "", 
        telegramLink: u.telegramLink || "",
        agentMaxUsers: u.agentMaxUsers || 100,
        isApiActive: u.isApiActive || false,
        // 💥 MAGIC FIX: NOW THE FRONTEND KNOWS IF AGENT HAS PERMISSION 💥
        canManageApi: u.canManageApi || false 
      };
    });

    // 💥 2. RAM PROTECTOR & PARALLEL EXECUTION: 5 Queries running at once! 💥
    const [globalTotalUsers, totalAgents, activeAccounts, bannedAccounts, liabilityAgg] = await Promise.all([
        User.countDocuments({ role: "user" }),
        User.countDocuments({ role: "agent" }),
        User.countDocuments({ status: "active" }),
        User.countDocuments({ status: "banned" }),
        User.aggregate([
            { $match: { role: { $in: ["user", "agent"] } } },
            { $group: { _id: null, total: { $sum: { $convert: { input: "$balance", to: "double", onError: 0, onNull: 0 } } } } }
        ])
    ]);
    
    // System Liability (ডাটাবেস নিজেই সব ইউজারের ব্যালেন্স যোগ করে পাঠিয়েছে)
    const systemLiability = liabilityAgg[0]?.total || 0;

    return NextResponse.json({ 
        users: formattedUsers,
        pagination: { total: totalUsersInQuery, page, limit, totalPages: Math.ceil(totalUsersInQuery / limit) || 1 },
        stats: { 
          totalUsers: globalTotalUsers, 
          totalAgents, 
          activeAccounts, 
          bannedAccounts, 
          systemLiability: systemLiability.toFixed(2) 
        }
    }, { status: 200 });
  } catch (error: any) { 
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); 
  }
}