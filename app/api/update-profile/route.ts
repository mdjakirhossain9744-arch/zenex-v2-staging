import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import User from "../../../models/User"; 

export async function POST(req: NextRequest) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    // 💥 হ্যাকার প্রটেকশন: কুকি থেকে ইউজারের আসল ইমেইল বের করা হচ্ছে 💥
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    let userEmail = "";
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      userEmail = decodedPayload.email; // টোকেন থেকে ইমেইল নেওয়া হলো, ফ্রন্টএন্ড থেকে নয়!
    } catch (err) {
      return NextResponse.json({ success: false, message: "Invalid Token" }, { status: 403 });
    }

    const body = await req.json();
    const { name, phone, address } = body;

    // ডাটাবেসে শুধু নির্দিষ্ট ফিল্ডগুলো আপডেট করা হচ্ছে
    const updatedUser = await User.findOneAndUpdate(
      { email: userEmail },
      { $set: { fullName: name, mobile: phone, address: address } },
      { new: true }
    );

    if (!updatedUser) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully!" });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}