import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const num = searchParams.get("number");

    if (!num) {
      return NextResponse.json({ error: "Please provide a number! Example: /api/check-db?number=2250767688370" });
    }

    await connectToDatabase();
    
    // ওই নাম্বারের ডাটা খুঁজবে
    const order = await Order.findOne({ searchNumber: num }).lean();

    if (!order) {
      return NextResponse.json({ error: "Number not found in Database!" });
    }

    // সরাসরি কাঁচা ডাটা রিটার্ন করবে
    return NextResponse.json({
      success: true,
      searchNumber: order.searchNumber,
      status: order.status,
      receivedNidsCount: order.receivedNids?.length || 0,
      receivedNidsList: order.receivedNids || [],
      fullMessage: order.fullMessage,
      otp: order.otp
    });
  } catch (error) {
    return NextResponse.json({ error: "Database Error" });
  }
}