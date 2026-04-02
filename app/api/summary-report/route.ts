import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

// 💥 ম্যাজিক: সার্ভারে বাংলাদেশ টাইম ফোর্স করা হলো 💥
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
    const { email, role } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') });
    if (!currentUser) return NextResponse.json({ success: false });

    // ডাটাবেস থেকে সব ইউজার মেমরিতে এনে নিখুঁত ম্যাপ তৈরি (যাতে ডাটা মিস না হয়)
    const allUsers = await User.find({}).select("email agentEmail customAgentMail otpRate");
    const targetEmails = new Set<string>();
    const rateMap: Record<string, number> = {};

    let userRate = currentUser.otpRate || 0.50;
    let balance = currentUser.balance || 0;

    if (role === "agent") {
        userRate = currentUser.agentMaxRate || 0.70;
        balance = currentUser.agentEarning || 0;
        targetEmails.add(safeEmail); 

        allUsers.forEach(u => {
            const uEmail = u.email.toLowerCase().trim();
            const aEmail = (u.agentEmail || "").toLowerCase().trim();
            const customA = (u.customAgentMail || "").toLowerCase().trim();

            if (aEmail === safeEmail || customA === safeEmail) {
                targetEmails.add(uEmail);
                rateMap[uEmail] = u.otpRate || 0.50;
            }
        });
    } else if (role === "admin") {
        userRate = 0.50;
    } else {
        targetEmails.add(safeEmail);
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const orders = await Order.find({ createdAt: { $gte: sixtyDaysAgo } }).select("status dateString createdAt fullMessage userEmail");

    const groupedRawData: Record<string, any> = {};

    orders.forEach(o => {
       const oEmail = (o.userEmail || "").toLowerCase().trim();
       
       // শুধুমাত্র এই এজেন্টের ইউজারের ডাটাই কাউন্ট হবে
       if (role !== "admin" && !targetEmails.has(oEmail)) return;

       // 💥 বাংলাদেশ টাইম অনুযায়ী ডাটাবেসের অরিজিনাল ডেট 💥
       const finalDateStr = o.dateString || getBDDateString(o.createdAt);

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { allocation: 0, success: 0, failed: 0, amount: 0 };
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[finalDateStr].allocation += msgCount; 
          groupedRawData[finalDateStr].success += msgCount;

          if (!isFreeService) {
              let earned = 0;
              if (role === "admin") {
                 earned = userRate * msgCount; 
              } else if (role === "agent") {
                 const mRate = rateMap[oEmail] || 0.50;
                 earned = Math.max(0, userRate - mRate) * msgCount; 
              } else {
                 earned = userRate * msgCount;
              }
              groupedRawData[finalDateStr].amount += earned;
          }
       } else {
          groupedRawData[finalDateStr].allocation += 1;
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    return NextResponse.json({
       success: true,
       groupedRawData,
       userRate,
       balance,
       serverDate: getBDDateString() // 💥 সার্ভার থেকে একদম ফ্রেশ BD Time পাঠানো হলো 💥
    });

  } catch (error) {
    return NextResponse.json({ success: false });
  }
}