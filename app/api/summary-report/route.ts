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

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    let userRate = 0.50;
    let balance = 0;
    let targetEmail = "";

    if (role === "admin") {
        userRate = 0.50; 
    } else {
        userRate = currentUser.otpRate || 0.50;
        balance = currentUser.balance || 0;
        targetEmail = safeEmail;
    }

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const orderQuery: any = { createdAt: { $gte: sixtyDaysAgo } };
    
    if (role !== "admin") {
       orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    }

    // 🚀 ROCKET SPEED FIX: .lean() apply kora holo 🚀
    const orders = await Order.find(orderQuery)
        .select("status dateString createdAt fullMessage userEmail")
        .lean();

    const groupedRawData: Record<string, any> = {};

    orders.forEach((o: any) => {
       const finalDateStr = o.dateString || getBDDateString(o.createdAt);

       if (!groupedRawData[finalDateStr]) {
           // 💥 Data perfectly formatted for Dashboard 💥
           groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       }
       
       const isFreeService = o.fullMessage && (o.fullMessage.toLowerCase().includes("whatsapp") || o.fullMessage.toLowerCase().includes("telegram") || o.fullMessage.toLowerCase().includes("t.me"));

       if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
          const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
          groupedRawData[finalDateStr].total += msgCount; 
          groupedRawData[finalDateStr].allocation += msgCount; 
          groupedRawData[finalDateStr].success += msgCount;

          if (!isFreeService) {
              groupedRawData[finalDateStr].amount += (userRate * msgCount);
          }
       } else {
          groupedRawData[finalDateStr].total += 1;
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
    console.error("Summary Report Error:", error);
    return NextResponse.json({ success: false });
  }
}