import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

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

    let userRate = 0.50;
    let balance = 0;
    let targetEmail = "";

    // 💥 ম্যাজিক: এজেন্টের সব কোড মুছে ফেলা হলো। এটা এখন শুধু এডমিন আর ইউজারের জন্য! 💥
    if (role === "admin") {
        userRate = 0.50; // এডমিনের ডিফল্ট রেট
    } else {
        userRate = currentUser.otpRate || 0.50;
        balance = currentUser.balance || 0;
        targetEmail = safeEmail;
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const orderQuery: any = { createdAt: { $gte: sixtyDaysAgo } };
    
    // এডমিন না হলে শুধু নিজের ইমেইলের ডাটা আনবে
    if (role !== "admin") {
       orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    }

    const orders = await Order.find(orderQuery).select("status dateString createdAt fullMessage");

    const groupedRawData: Record<string, any> = {};

    orders.forEach(o => {
       const finalDateStr = o.dateString || getBDDateString(o.createdAt);

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { allocation: 0, success: 0, failed: 0, amount: 0 };
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[finalDateStr].allocation += msgCount; 
          groupedRawData[finalDateStr].success += msgCount;

          // এডমিন এবং ইউজারের ইনকাম হিসাব
          if (!isFreeService) {
              groupedRawData[finalDateStr].amount += (userRate * msgCount);
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
       serverDate: getBDDateString() 
    });

  } catch (error) {
    return NextResponse.json({ success: false });
  }
}