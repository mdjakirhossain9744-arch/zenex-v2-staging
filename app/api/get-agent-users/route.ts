import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order"; // 💥 নতুন: Order ডাটাবেস অ্যাড করা হলো

export async function POST(req: Request) {
  try {
    const { agentEmail } = await req.json();

    if (!agentEmail) {
      return NextResponse.json({ message: "Agent email is required" }, { status: 400 });
    }

    await connectToDatabase();

    // এজেন্টকে খুঁজে বের করা
    const agent = await User.findOne({ 
      $or: [{ email: agentEmail }, { customAgentMail: agentEmail }],
      role: "agent" 
    });

    if (!agent) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    }

    // এই এজেন্টের আন্ডারে থাকা সব ইউজারদের খুঁজে বের করা
    const users = await User.find({
      $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }],
      role: "user"
    }).select("-password").sort({ createdAt: -1 });

    // আজকের তারিখ বের করা
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 💥 ম্যাজিক: প্রতিটি ইউজারের আজকের OTP সংখ্যা ডাটাবেস থেকে গোনা হচ্ছে 💥
    const formattedUsers = await Promise.all(users.map(async (u) => {
      
      // Order টেবিল থেকে এই ইউজারের আজকের DONE স্ট্যাটাস গোনা
      const todayOtpCount = await Order.countDocuments({
         userEmail: u.email,
         dateString: todayStr,
         status: "DONE"
      });

      return {
        id: u._id,
        uid: `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`,
        name: u.fullName,
        email: u.email,
        balance: u.balance || 0,
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        todayOTP: todayOtpCount, // 💥 রিয়েল ডাটা 💥
        rate: u.otpRate || "0.50",
        isApiActive: u.isApiActive || false // 💥 API স্ট্যাটাস পাঠানো হচ্ছে 💥
      };
    }));

    return NextResponse.json({ 
      users: formattedUsers, 
      maxLimit: agent.agentMaxUsers || 100, 
      agentRevenue: agent.agentEarning || 0,
      agentRate: agent.agentMaxRate || 0.70
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}