import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order"; 

export const dynamic = "force-dynamic";

// 💥 ম্যাজিক: বাংলাদেশ টাইম বের করার গ্লোবাল ফাংশন 💥
const getBDDateString = (dateObj: Date | number | string = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
  }).format(new Date(dateObj));
};

export async function POST(req: Request) {
  try {
    const { agentEmail } = await req.json();

    if (!agentEmail) {
      return NextResponse.json({ message: "Agent email is required" }, { status: 400 });
    }

    await connectToDatabase();

    const safeAgentEmail = agentEmail.toLowerCase().trim();

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

    const users = await User.find({
      $or: [
        { agentEmail: new RegExp(`^${agent.email}$`, 'i') }, 
        { agentEmail: agent.customAgentMail ? new RegExp(`^${agent.customAgentMail}$`, 'i') : null }
      ].filter(condition => condition.agentEmail !== null),
      role: "user"
    }).select("-password").sort({ createdAt: -1 });

    // 💥 ম্যাজিক: লন্ডনের টাইমের বদলে পারফেক্ট বাংলাদেশ টাইমের আজকের ডেট 💥
    const todayStr = getBDDateString();

    const formattedUsers = await Promise.all(users.map(async (u) => {
      
      // শুধুমাত্র আজকের (BD Time) সাকসেসফুল ওটিপি গোনা হবে
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
        balance: Number(u.balance || 0).toFixed(2),
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        todayOTP: todayOtpCount, // রাত ১২টায় জিরো হয়ে যাবে!
        rate: Number(u.otpRate || 0.50).toFixed(2),
        isApiActive: u.isApiActive || false 
      };
    }));

    return NextResponse.json({ 
      users: formattedUsers, 
      maxLimit: agent.agentMaxUsers || 100, 
      agentRevenue: Number(agent.agentEarning || 0).toFixed(2),
      agentRate: Number(agent.agentMaxRate || 0.70).toFixed(2)
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}