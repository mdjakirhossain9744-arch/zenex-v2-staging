import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import DailyStat from "../../../models/DailyStat";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const secretKey = searchParams.get("key");

    // সিকিউরিটি লক: এই চাবি ছাড়া কেউ কোড রান করতে পারবে না
    if (secretKey !== "ZENEX_MIGRATE_2026") {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: Access Denied!" }, { status: 403 });
    }

    await connectToDatabase();

    // ১. ডাটাবেস থেকে সব ইউজারের বর্তমান রেট বের করা
    const users = await User.find({}).lean();
    const userMap: Record<string, any> = {};
    const agentRateMap: Record<string, number> = {};

    users.forEach((u: any) => {
      if (u.email) {
        const email = u.email.toLowerCase().trim();
        userMap[email] = {
          role: u.role,
          otpRate: Number(u.otpRate) || 0.50,
          agentEmail: u.agentEmail ? u.agentEmail.toLowerCase().trim() : null
        };
      }
      if (u.role === "agent") {
         const rate = Number(u.agentMaxRate) || 0.70;
         if (u.email) agentRateMap[u.email.toLowerCase().trim()] = rate;
         if (u.customAgentMail) agentRateMap[u.customAgentMail.toLowerCase().trim()] = rate;
      }
    });

    // ২. ডায়েরি (DailyStat) থেকে পুরনো ডাটাগুলো বের করা যাদের সাকসেস > 0
    const stats = await DailyStat.find({ successOTP: { $gt: 0 } }).lean();
    let updatedCount = 0;

    for (const stat of stats) {
       const email = (stat.userEmail || "").toLowerCase().trim();
       const user = userMap[email];
       
       let cost = 0;
       let commission = 0;

       if (user && user.role === "user") {
           // ইউজারের বর্তমান রেটের সাথে পুরনো সাকসেস ওটিপি গুণ করে স্ট্যাটিক করা হচ্ছে
           cost = stat.successOTP * user.otpRate;
           
           // এজেন্টের কমিশন বের করা হচ্ছে
           if (user.agentEmail && agentRateMap[user.agentEmail]) {
               const aRate = agentRateMap[user.agentEmail];
               const comm = Number((stat.successOTP * (aRate - user.otpRate)).toFixed(2));
               if (comm > 0) commission = comm;
           }
       }

       // ৩. DailyStat ডায়েরিতে স্ট্যাটিক টাকা সেভ (Update) করে দেওয়া
       await DailyStat.updateOne(
           { _id: stat._id },
           { $set: { totalCost: cost, totalCommission: commission } }
       );
       updatedCount++;
    }

    return NextResponse.json({
        success: true,
        message: "✅ Migration Successful! Old records fixed permanently.",
        updatedRecords: updatedCount
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}