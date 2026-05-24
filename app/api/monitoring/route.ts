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
      return NextResponse.json({ success: false, message: "Unauthorized", data: [] });
    }

    let query: any = {};
    
    if (role === "agent") {
      // 💥 AGENT FIX: Case Insensitive Query 💥
      query = { agentEmail: email.toLowerCase() };
    }

    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(); 

    return NextResponse.json({ success: true, data: liveOrders });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Server Error", data: [] }, { status: 500 });
  }
}