export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";

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

    let query: any = {};
    if (rawSearchQuery) {
        // 💥 Safe Regex Search: Prevents 500 crashes if user types +, *, (, etc.
        const safeSearch = rawSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
            { fullName: { $regex: safeSearch, $options: "i" } },
            { email: { $regex: safeSearch, $options: "i" } }
        ];
    }

    const skip = (page - 1) * limit;
    const totalUsers = await User.countDocuments(query);
    
    const users = await User.find(query)
      .select("-password")
      .sort({ role: 1, createdAt: -1 }) 
      .skip(skip)
      .limit(limit)
      .lean();

    const userEmails = users.map(u => (u.email || "").toLowerCase().trim());
    const todayStr = getBDDateString();
    
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
        // 💥 UPDATE: Use updatedAt for accurate Today's OTP count matching the dashboard 💥
        const finalDateStr = o.updatedAt 
            ? getBDDateString(o.updatedAt) 
            : (o.createdAt ? getBDDateString(o.createdAt) : (o.dateString ? getBDDateString(new Date(o.dateString)) : getBDDateString(new Date())));
        
        if (finalDateStr === todayStr) {
            const e = (o.userEmail || o.email || "").toLowerCase().trim();
            
            // 💥 STRICT OTP COUNTER: Only count unique/real OTPs 💥
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
        isApiActive: u.isApiActive || false        
      };
    });

    // Global Stats for the top cards
    const totalAgents = await User.countDocuments({ role: "agent" });
    const activeAccounts = await User.countDocuments({ status: "active" });
    const bannedAccounts = await User.countDocuments({ status: "banned" });

    return NextResponse.json({ 
        users: formattedUsers,
        pagination: { total: totalUsers, page, limit, totalPages: Math.ceil(totalUsers / limit) || 1 },
        stats: { totalUsers, totalAgents, activeAccounts, bannedAccounts }
    }, { status: 200 });
  } catch (error: any) { 
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); 
  }
}