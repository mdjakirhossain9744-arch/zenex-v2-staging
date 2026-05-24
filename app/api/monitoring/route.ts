import { NextResponse } from "next/server";
// 💥 আপনার sync-orders ফাইলে ঠিক যেভাবে ইম্পোর্ট করা আছে, এখানেও সেভাবেই দেবেন 💥
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const body = await req.json().catch(() => ({}));
    const { role, email } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: "Unauthorized: No email provided", data: [] });
    }

    let query: any = {};
    
    // 💥 যদি এজেন্ট হয়, তবে শুধু তার ইউজারদের ডাটা দেখাবে 💥
    if (role === "agent") {
      query = { agentEmail: email };
    }
    // এডমিন হলে query ফাঁকা থাকবে {}, ফলে সে পুরো সাইটের সব ডাটা দেখবে!

    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(); // .lean() ডাটাবেসের লোড 0% রাখবে

    return NextResponse.json({ success: true, data: liveOrders });

  } catch (error: any) {
    // যদি কোনো কারণে ক্র্যাশ করে, তবে VS Code টার্মিনালে এই এররটা লাল হয়ে ভাসবে
    console.error("💥 Monitoring API Error:", error.message);
    return NextResponse.json({ success: false, message: "Server Error", data: [] }, { status: 500 });
  }
}