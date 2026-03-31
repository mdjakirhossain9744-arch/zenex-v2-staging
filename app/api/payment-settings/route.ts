// Location: app/api/payment-settings/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";
import PaymentSetting from "../../../models/PaymentSetting";

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }
    const body = await req.json();
    const { action, isWithdrawOpen, methods } = body;

    // সেটিংস ফেচ করা (পড়া)
    if (action === "FETCH") {
      let settings = await PaymentSetting.findOne({ type: "global" });
      if (!settings) {
        settings = await PaymentSetting.create({ type: "global" }); // প্রথমবার ডিফল্ট তৈরি করবে
      }
      return NextResponse.json({ success: true, data: settings });
    }

    // সেটিংস আপডেট করা (ON/OFF করলে)
    if (action === "UPDATE") {
      const updated = await PaymentSetting.findOneAndUpdate(
        { type: "global" },
        { isWithdrawOpen, methods },
        { new: true, upsert: true }
      );
      return NextResponse.json({ success: true, data: updated });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}