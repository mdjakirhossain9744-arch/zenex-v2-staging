export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order"; // 💥 ডাটাবেস অ্যাড করা হলো

// 💥 বাংলাদেশ টাইম বের করার গ্লোবাল ফাংশন 💥
const getBDDateString = (dateObj: Date | number | string = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
  }).format(new Date(dateObj));
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    
    if (!token) {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: Token missing" }, { status: 401 });
    }

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
    
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });

    // 💥 বাংলাদেশ টাইমের আজকের ডেট 💥
    const todayStr = getBDDateString();

    const formattedUsers = await Promise.all(users.map(async (u) => {
      
      // 💥 এডমিন প্যানেলেও এখন সবার আজকের রিয়েল ওটিপি কাউন্ট দেখাবে 💥
      const todayOtpCount = await Order.countDocuments({
         userEmail: new RegExp(`^${u.email}$`, 'i'), 
         dateString: todayStr,
         status: "DONE"
      });

      return {
        id: u._id,
        uid: `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`,
        name: u.fullName,
        email: u.email,
        role: u.role,
        agentEmail: u.agentEmail || "Admin",
        balance: Number(u.balance || 0).toFixed(2),
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        todayOTP: todayOtpCount, // রাত ১২টায় জিরো হয়ে যাবে!
        rate: Number(u.otpRate || 0.50).toFixed(2),
        customAgentMail: u.customAgentMail || "", 
        telegramLink: u.telegramLink || "",
        agentMaxUsers: u.agentMaxUsers || 100,
        isApiActive: u.isApiActive || false        
      };
    }));

    return NextResponse.json({ users: formattedUsers }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}