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
      const decodedPayload = JSON.parse(atob(payloadBase64));
      if (decodedPayload.role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
    } catch (err) { return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 }); }

    await connectToDatabase();
    
    // .lean() allows blazing fast DB read
    const users = await User.find({}).select("-password").sort({ createdAt: -1 }).lean();

    const todayStr = getBDDateString();
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // 💥 ROCKET SPEED: Single query for all exact OTPs 💥
    const orders = await Order.find({
        createdAt: { $gte: twoDaysAgo },
        status: { $in: ["DONE", "Success", "SUCCESS"] }
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
        todayOTP: todayOtpCount, // 💥 100% matched with Dashboard
        rate: Number(u.otpRate || 0.50).toFixed(2),
        customAgentMail: u.customAgentMail || "", 
        telegramLink: u.telegramLink || "",
        agentMaxUsers: u.agentMaxUsers || 100,
        isApiActive: u.isApiActive || false        
      };
    });

    return NextResponse.json({ users: formattedUsers }, { status: 200 });
  } catch (error: any) { return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); }
}