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
      // 💥 CRASH FIX: Safe Node.js Base64 Decode (Prevents 500 Error) 💥
      const decodedString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const decodedPayload = JSON.parse(decodedString);
      
      if (decodedPayload.role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
    } catch (err) { return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 }); }

    await connectToDatabase();

    // 💥 GET URL PARAMS FOR PAGINATION & SEARCH 💥
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const searchQuery = searchParams.get("search") || "";

    let query: any = {};
    if (searchQuery) {
        query.$or = [
            { fullName: { $regex: searchQuery, $options: "i" } },
            { email: { $regex: searchQuery, $options: "i" } }
        ];
    }

    const skip = (page - 1) * limit;
    const totalUsers = await User.countDocuments(query);
    
    // 💥 MAGIC FIX: Sort by Role first (Admin -> Agent -> User), then Date 💥
    // .lean() allows blazing fast DB read
    const users = await User.find(query)
      .select("-password")
      .sort({ role: 1, createdAt: -1 }) 
      .skip(skip)
      .limit(limit)
      .lean();

    // 💥 ROCKET SPEED: Only fetch orders for the 50 users on the current page 💥
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

    // We also need overall stats, but counting all users is fast.
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