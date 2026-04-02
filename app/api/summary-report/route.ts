import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const { email, role } = await req.json();

    let targetEmails: string[] = [];
    let userRate = 0.50;
    let balance = 0;

    const safeEmail = email.toLowerCase().trim();

    // 💥 সিকিউরিটি ১: যে রিকোয়েস্ট করছে, সে আসলেই আছে কিনা চেক
    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') });
    if (!currentUser) return NextResponse.json({ success: false, message: "Unauthorized Request" });

    const memberRateMap: Record<string, number> = {};

    if (role === "agent") {
       // 💥 সিকিউরিটি ২: শুধুমাত্র এই এজেন্টের আন্ডারে থাকা ইউজারদের ডাটাবেস থেকে টানা হচ্ছে
       const members = await User.find({
           $or: [
               { agentEmail: new RegExp(`^${safeEmail}$`, 'i') },
               { customAgentMail: new RegExp(`^${safeEmail}$`, 'i') }
           ]
       });
       
       targetEmails = members.map(m => m.email.toLowerCase().trim());
       targetEmails.push(safeEmail); // এজেন্টের নিজের ইমেইলটাও অ্যাড করা হলো

       members.forEach(m => { memberRateMap[m.email.toLowerCase().trim()] = m.otpRate || 0.50; });
       memberRateMap[safeEmail] = currentUser.otpRate || 0.50;

       userRate = currentUser.agentMaxRate || 0.70;
       balance = currentUser.agentEarning || 0; 
    } else if (role === "admin") {
       userRate = 0.50; 
       balance = 0; 
    } else {
       targetEmails = [safeEmail];
       userRate = currentUser.otpRate || 0.50;
       balance = currentUser.balance || 0;
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 💥 সিকিউরিটি ৩: হ্যাকার-প্রুফ ডাটাবেস কোয়েরি 💥
    const orderQuery: any = { createdAt: { $gte: sixtyDaysAgo } };
    
    if (role !== "admin") {
       // ডাটাবেসকে কড়া নির্দেশ: "শুধুমাত্র এই ইমেইলগুলোর অর্ডারই আমাকে দেবে, অন্য কারও নয়!"
       const regexEmails = targetEmails.map(e => new RegExp(`^${e}$`, 'i'));
       orderQuery.userEmail = { $in: regexEmails };
    }

    // শুধুমাত্র পারমিশন পাওয়া ডাটাগুলোই বের হয়ে আসবে
    const orders = await Order.find(orderQuery).select("status dateString createdAt fullMessage userEmail");

    const groupedRawData: Record<string, any> = {};

    orders.forEach(o => {
       const oEmail = (o.userEmail || "").toLowerCase().trim();
       const d = o.dateString || new Date(o.createdAt).toISOString().split('T')[0];
       
       if (!groupedRawData[d]) groupedRawData[d] = { allocation: 0, success: 0, failed: 0, amount: 0 };
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("wa.me") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[d].allocation += msgCount; 
          groupedRawData[d].success += msgCount;

          // 💥 নিখুঁত কমিশন হিসাব 💥
          if (!isFreeService) {
              let earned = 0;
              if (role === "admin") {
                 earned = userRate * msgCount; 
              } else if (role === "agent") {
                 const mRate = memberRateMap[oEmail] || 0.50;
                 earned = Math.max(0, userRate - mRate) * msgCount; // এজেন্টের কমিশন
              } else {
                 earned = userRate * msgCount;
              }
              groupedRawData[d].amount += earned;
          }
       } else {
          groupedRawData[d].allocation += 1;
          groupedRawData[d].failed += 1;
       }
    });

    return NextResponse.json({
       success: true,
       groupedRawData,
       userRate,
       balance,
       serverDate: new Date().toISOString()
    });

  } catch (error) {
    console.error("Summary API Error:", error);
    return NextResponse.json({ success: false });
  }
}