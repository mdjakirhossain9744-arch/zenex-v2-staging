import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order"; 

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { agentEmail } = await req.json();

    if (!agentEmail) {
      return NextResponse.json({ message: "Agent email is required" }, { status: 400 });
    }

    await connectToDatabase();

    // 💥 ইমেইলকে Case-Insensitive করা হলো যাতে ক্যাপিটাল/স্মল লেটারের জন্য ইউজার গায়েব না হয় 💥
    const safeAgentEmail = agentEmail.toLowerCase().trim();

    // এজেন্টকে খুঁজে বের করা
    const agent = await User.findOne({ 
      $or: [
        { email: new RegExp(`^${safeAgentEmail}$`, 'i') }, 
        { customAgentMail: new RegExp(`^${safeAgentEmail}$`, 'i') }
      ],
      role: "agent" 
    });

    if (!agent) {
      return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    }

    // এই এজেন্টের আন্ডারে থাকা সব ইউজারদের খুঁজে বের করা
    const users = await User.find({
      $or: [
        { agentEmail: new RegExp(`^${agent.email}$`, 'i') }, 
        { agentEmail: agent.customAgentMail ? new RegExp(`^${agent.customAgentMail}$`, 'i') : null }
      ].filter(condition => condition.agentEmail !== null),
      role: "user"
    }).select("-password").sort({ createdAt: -1 });

    // আজকের তারিখ বের করা
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 💥 প্রতিটি ইউজারের আজকের OTP সংখ্যা ডাটাবেস থেকে গোনা হচ্ছে 💥
    const formattedUsers = await Promise.all(users.map(async (u) => {
      
      // Order টেবিল থেকে এই ইউজারের আজকের DONE স্ট্যাটাস গোনা
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
        // 💥 ম্যাজিক: 3.99999999 কে 4.00 বা 3.99 বানানো হলো! 💥
        balance: Number(u.balance || 0).toFixed(2),
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        todayOTP: todayOtpCount, 
        // 💥 ম্যাজিক: রেটকেও ২ দশমিক করে দেওয়া হলো! 💥
        rate: Number(u.otpRate || 0.50).toFixed(2),
        isApiActive: u.isApiActive || false 
      };
    }));

    return NextResponse.json({ 
      users: formattedUsers, 
      maxLimit: agent.agentMaxUsers || 100, 
      // 💥 ম্যাজিক: এজেন্টের রেভিনিউ এবং রেটকেও ২ দশমিক করে দেওয়া হলো! 💥
      agentRevenue: Number(agent.agentEarning || 0).toFixed(2),
      agentRate: Number(agent.agentMaxRate || 0.70).toFixed(2)
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}