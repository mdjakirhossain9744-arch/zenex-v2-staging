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
    
    // নাম্বারটির সমস্ত হিস্ট্রি বের করে লেটেস্ট (সবচেয়ে নতুন) অর্ডারে সর্ট করা হচ্ছে
    const orders = await Order.find({ searchNumber: num })
                              .sort({ createdAt: -1 })
                              .lean();

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "Number not found in Database!" });
    }

    // সবচেয়ে নতুন অর্ডারটি (Latest Order) টার্গেট করা হলো
    const latestOrder = orders[0];

    // সরাসরি কাঁচা ডাটা রিটার্ন করবে (আপনার এডমিন প্যানেল যেন ব্রেক না করে তাই স্ট্রাকচার সেম রাখা হলো)
    return NextResponse.json({
      success: true,
      searchNumber: latestOrder.searchNumber,
      status: latestOrder.status,
      receivedNidsCount: latestOrder.receivedNids?.length || 0,
      receivedNidsList: latestOrder.receivedNids || [],
      fullMessage: latestOrder.fullMessage,
      otp: latestOrder.otp,
      
      // === BOSS LEVEL AUDIT DATA ===
      createdAt: latestOrder.createdAt,
      isRecycledNumber: orders.length > 1, // নাম্বারটি আগে কেউ কিনেছিল কিনা
      totalTimesOrdered: orders.length, // মোট কতবার কেনা হয়েছে
      pastHistory: orders.map(o => ({ 
        status: o.status, 
        time: o.createdAt, 
        otpCount: o.receivedNids?.length || 0 
      }))
    });
  } catch (error: any) {
    console.error("[CHECK-DB ERROR]:", error);
    return NextResponse.json({ error: "Database Error", details: error.message });
  }
}