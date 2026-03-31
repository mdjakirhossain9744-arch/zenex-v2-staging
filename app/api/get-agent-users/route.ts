export const dynamic = 'force-dynamic'; 

import { NextResponse } from "next/server";
import mongoose from "mongoose";
import User from "../../../models/User"; 

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const { agentEmail } = await req.json();

    if (!agentEmail) {
      return NextResponse.json({ message: "Agent Email is required!" }, { status: 400 });
    }
    
    const agent = await User.findOne({ email: agentEmail });
    
    let searchCondition: any[] = [{ agentEmail: agentEmail }];
    if (agent && agent.customAgentMail) {
      searchCondition.push({ agentEmail: agent.customAgentMail });
    }

    const networkUsers = await User.find({ 
      $or: searchCondition, 
      role: "user" 
    }).select("-password").sort({ createdAt: -1 });

    const formattedUsers = networkUsers.map(u => ({
      id: u._id,
      uid: `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`,
      name: u.fullName,
      email: u.email,
      role: u.role,
      agentEmail: u.agentEmail,
      balance: u.balance || 0,
      status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
      todayOTP: 0,
      rate: u.otpRate || "0.50",
      customAgentMail: u.customAgentMail || "", 
      telegramLink: u.telegramLink || ""
    }));

    // 💥 মাস্টার হ্যাক: otpRate এবং agentMaxRate এর মধ্যে যেটা বড়, সেটাই লিমিট হবে 💥
    let maxR = agent?.agentMaxRate || 0;
    let otpR = agent?.otpRate || 0;
    let finalLimit = Math.max(maxR, otpR);
    if (finalLimit === 0) finalLimit = 0.70; // ডিফল্ট

    const limit = agent?.agentMaxUsers || 100;

    return NextResponse.json({ 
      users: formattedUsers, 
      maxLimit: limit,
      agentRevenue: agent?.agentEarning || 0,
      agentRate: finalLimit // 👈 রিয়েল লিমিট পাঠানো হলো
    }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}