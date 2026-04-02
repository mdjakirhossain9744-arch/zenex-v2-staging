import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

// বাংলাদেশ টাইম বের করার গ্লোবাল ফাংশন
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
    await connectToDatabase();
    const { email } = await req.json(); // শুধু এজেন্টের ইমেইল আসবে

    const safeAgentEmail = email.toLowerCase().trim();

    // ১. এজেন্টকে খোঁজা হচ্ছে
    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') });
    if (!agent) return NextResponse.json({ success: false, message: "Agent not found" });

    // ২. এজেন্টের আন্ডারে থাকা সব ইউজারকে খোঁজা হচ্ছে
    const networkUsers = await User.find({
        $or: [
            { agentEmail: new RegExp(`^${safeAgentEmail}$`, 'i') },
            { customAgentMail: new RegExp(`^${safeAgentEmail}$`, 'i') }
        ]
    });

    // ৩. মেমরিতে ইউজারদের ইমেইল এবং রেট সেভ করা হচ্ছে
    const targetEmails = new Set<string>();
    const userRateMap: Record<string, number> = {};

    targetEmails.add(safeAgentEmail); // এজেন্টের নিজের ইমেইল
    userRateMap[safeAgentEmail] = agent.otpRate || 0.50;

    networkUsers.forEach(u => {
        const uEmail = u.email.toLowerCase().trim();
        targetEmails.add(uEmail);
        userRateMap[uEmail] = u.otpRate || 0.50;
    });

    const agentMaxRate = agent.agentMaxRate || 0.70;
    const agentTotalBalance = agent.agentEarning || 0;

    // ৪. গত ৬০ দিনের অর্ডার টানা হচ্ছে (শুধু এই নেটওয়ার্কের)
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const regexEmails = Array.from(targetEmails).map(e => new RegExp(`^${e}$`, 'i'));

    const orders = await Order.find({ 
        createdAt: { $gte: sixtyDaysAgo },
        userEmail: { $in: regexEmails }
    }).select("status dateString createdAt fullMessage userEmail");

    // ৫. দিন অনুযায়ী ডাটা সাজানো এবং কমিশন হিসাব করা
    const groupedRawData: Record<string, any> = {};

    orders.forEach(o => {
       const oEmail = (o.userEmail || "").toLowerCase().trim();
       const finalDateStr = o.dateString || getBDDateString(o.createdAt);

       if (!groupedRawData[finalDateStr]) {
           groupedRawData[finalDateStr] = { allocation: 0, success: 0, failed: 0, amount: 0 };
       }
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[finalDateStr].allocation += msgCount; 
          groupedRawData[finalDateStr].success += msgCount;

          if (!isFreeService) {
              const uRate = userRateMap[oEmail] || 0.50;
              // 💥 এজেন্টের কমিশন = (এজেন্টের রেট - ইউজারের রেট) * ওটিপি সংখ্যা 💥
              const commission = Math.max(0, agentMaxRate - uRate) * msgCount;
              groupedRawData[finalDateStr].amount += commission;
          }
       } else {
          groupedRawData[finalDateStr].allocation += 1;
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    return NextResponse.json({
       success: true,
       groupedRawData,
       userRate: agentMaxRate, // প্যানেলে দেখানোর জন্য
       balance: agentTotalBalance, // লাইফটাইম কমিশন
       serverDate: getBDDateString() // BD Time
    });

  } catch (error) {
    console.error("Agent Summary Error:", error);
    return NextResponse.json({ success: false });
  }
}