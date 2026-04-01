import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import PaymentSetting from "../../../models/PaymentSetting";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    // 💥 হ্যাকার প্রটেকশন: NextRequest থেকে কুকি নেওয়া হলো 💥
    const token = req.cookies.get("zenex_token")?.value;
    
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });
    
    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
    }

    const userRole = decoded.role;

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }
    const body = await req.json();
    const { action, isWithdrawOpen, methods } = body;

    // FETCH সবার জন্য অ্যালাউ করা হলো
    if (action === "FETCH") {
      let settings = await PaymentSetting.findOne({ type: "global" });
      if (!settings) {
        settings = await PaymentSetting.create({ type: "global" }); 
      }
      return NextResponse.json({ success: true, data: settings });
    }

    // UPDATE শুধুমাত্র সুপার এডমিন করতে পারবে
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