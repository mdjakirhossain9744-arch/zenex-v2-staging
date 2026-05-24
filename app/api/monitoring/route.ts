import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    const { role, email } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: "Unauthorized" });
    }

    // এডমিন হলে সব ডাটা, এজেন্ট হলে শুধু তার আন্ডারের ইউজারদের ডাটা
    let query: any = {};
    if (role === "agent") {
      query = { agentEmail: email };
    }

    // 💥 .lean() Magic: ডাটাবেসকে বিন্দুমাত্র লোড না দিয়ে শুধু Raw JSON ডাটা টানবে 💥
    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .select("createdAt userName userUid searchNumber country operator status")
      .lean();

    return NextResponse.json({ success: true, data: liveOrders });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}