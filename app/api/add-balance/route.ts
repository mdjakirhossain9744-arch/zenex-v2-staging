import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import User from "../../../models/User";

export async function POST(req: Request) {
  try {
    const { userEmail } = await req.json();
    await connectToDatabase();

    const user = await User.findOne({ email: userEmail });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // ইউজারের রেট
    const userEarns = Number(user.otpRate || user.rate || 0.50);
    
    // ১. ইউজারের ব্যালেন্স এবং আজকের OTP আপডেট
    user.balance = Number((user.balance + userEarns).toFixed(2));
    user.todayOTP = (user.todayOTP || 0) + 1;
    await user.save();

    // ২. এজেন্টের কমিশন হিসাব করা 💥 (ম্যাজিক লজিক)
    if (user.agentEmail && user.agentEmail !== "admin@zenexnetwork.com" && user.agentEmail !== "admin") {
      const agent = await User.findOne({
        $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
      });

      // চেক করছি সে আসলেই এজেন্ট কি না
      if (agent && agent.role?.toLowerCase() === "agent") {
        // এজেন্টের নিজের রেট (agentMaxRate) ডাটাবেস থেকে নেওয়া হচ্ছে
        const agentRate = Number(agent.agentMaxRate || agent.otpRate || 0.70); 
        const agentProfit = Number((agentRate - userEarns).toFixed(2)); // এজেন্টের লাভ (যেমন: ০.৭০ - ০.৫০ = ০.২০)
        
        // যদি প্রফিট শূন্যের চেয়ে বড় হয়, তবেই যোগ হবে
        if (agentProfit > 0) {
          agent.agentEarning = Number(((agent.agentEarning || 0) + agentProfit).toFixed(2)); 
          agent.balance = Number(((agent.balance || 0) + agentProfit).toFixed(2)); // এজেন্টের মূল ব্যালেন্সে যোগ 💥
          await agent.save();
        }
      }
    }

    return NextResponse.json({ success: true, balance: user.balance });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}