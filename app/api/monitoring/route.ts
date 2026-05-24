import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    
    // role: "admin" বা "agent" আসবে
    const { role, email } = body;

    let query: any = {};
    
    // যদি রিকোয়েস্টটি কোনো এজেন্টের হয়, তবে শুধু তার ইমেইল দিয়ে ফিল্টার হবে
    if (role === "agent") {
      if (!email) return NextResponse.json({ success: false, data: [] });
      query = { agentEmail: email.toLowerCase() };
    }
    // Admin হলে query ফাঁকা থাকবে, মানে সবার ডাটা দেখাবে!

    // 💥 Zero-Load Query: .lean() দিয়ে ডাটা আনা হচ্ছে 💥
    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50) // সর্বোচ্চ ৫০টি লেটেস্ট অর্ডার দেখাবে
      .lean(); 

    return NextResponse.json({ success: true, data: liveOrders });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], message: "Monitoring Fetch Error" });
  }
}