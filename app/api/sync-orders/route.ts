import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    const { action, email, orderData } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    // 💥 ১. ডাটাবেস থেকে সব নাম্বার টেনে আনা (বট এবং ওয়েবসাইট উভয়ের) 💥
    if (action === "FETCH") {
      const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 }).limit(200); // শেষের ২০০টি নাম্বার আনবে
      
      // ফ্রন্টএন্ডের জন্য ডাটা সাজানো হচ্ছে
      const mappedOrders = orders.map((o) => ({
        id: o._id.toString(),
        dateString: o.dateString,
        displayNumber: o.displayNumber,
        searchNumber: o.searchNumber,
        country: o.country,
        operator: o.operator,
        status: o.status,
        otp: o.otp,
        fullMessage: o.fullMessage,
        seenMessages: o.fullMessage ? [o.fullMessage] : [],
        isDup: false,
        createdAt: new Date(o.createdAt).getTime(),
        receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
      }));

      return NextResponse.json({ success: true, orders: mappedOrders });
    }

    // 💥 ২. ওয়েবসাইট থেকে ম্যানুয়ালি নাম্বার নিলে সেটা ডাটাবেসে সেভ করা 💥
    if (action === "CREATE") {
      const newOrder = new Order({
        userEmail: email,
        searchNumber: orderData.searchNumber,
        displayNumber: orderData.displayNumber,
        country: orderData.country,
        operator: orderData.operator,
        status: orderData.status,
        otp: orderData.otp,
        fullMessage: orderData.fullMessage,
        dateString: orderData.dateString
      });
      await newOrder.save();
      return NextResponse.json({ success: true });
    }

    // 💥 ৩. ওয়েবসাইট থেকে OTP পেলে সেটা ডাটাবেসে আপডেট করা 💥
    if (action === "UPDATE") {
      await Order.updateMany(
        { searchNumber: orderData.searchNumber, userEmail: email, status: "WAIT" },
        { $set: { status: orderData.status, otp: orderData.otp, fullMessage: orderData.fullMessage } }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    console.error("Sync Order API Error:", error);
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}