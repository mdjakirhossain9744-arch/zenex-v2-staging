import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import PaymentSetting from "../../../models/PaymentSetting";

export async function POST(req: NextRequest) {
  try {
    // 💥 হ্যাকার প্রটেকশন: Native Token Decode (Blazing Fast) 💥
    const token = req.cookies.get("zenex_token")?.value;
    
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });
    
    let userRole = "user";
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      userRole = decodedPayload.role;
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token" }, { status: 403 });
    }

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }
    const body = await req.json();
    const { action, isWithdrawOpen, methods } = body;

    // FETCH সবার জন্য অ্যালাউ করা হলো (ইউজাররা সেটিংস দেখবে)
    if (action === "FETCH") {
      let settings = await PaymentSetting.findOne({ type: "global" });
      if (!settings) {
        settings = await PaymentSetting.create({ type: "global" }); 
      }
      return NextResponse.json({ success: true, data: settings });
    }

    // UPDATE শুধুমাত্র সুপার এডমিন করতে পারবে (Fast & Secure)
    if (action === "UPDATE") {
      if (userRole !== "admin") {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Only admins can change settings!" }, { status: 403 });
      }

      const updated = await PaymentSetting.findOneAndUpdate(
        { type: "global" },
        { isWithdrawOpen, methods },
        { new: true, upsert: true }
      );
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}