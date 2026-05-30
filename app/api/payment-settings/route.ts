import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import PaymentSetting from "../../../models/PaymentSetting";

// 💥 Next.js কে ক্যাশ করতে বারণ করা হলো
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 💥 CRASH FIX: Strong DB Connection Check
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }
    
    // 💥 CRASH FIX: Safe JSON Parse (যাতে বডি ফাঁকা থাকলেও ক্র্যাশ না করে)
    const body = await req.json().catch(() => ({}));
    
    // 💥 NEW: isManualWithdrawOpen & binanceAutoPayActive Added 💥
    const { action, isWithdrawOpen, isManualWithdrawOpen, methods, binanceAutoPayActive } = body;

    // 🟢 FETCH সবার জন্য অ্যালাউ করা হলো (ইউজাররা টোকেন ছাড়াই লাইভ সেটিংস দেখবে)
    if (action === "FETCH") {
      let settings = await PaymentSetting.findOne({ type: "global" });
      if (!settings) {
        settings = await PaymentSetting.create({ type: "global" }); 
      }
      return NextResponse.json({ success: true, data: settings });
    }

    // 🔴 UPDATE শুধুমাত্র সুপার এডমিন করতে পারবে (এখানে টোকেন চেক হবে)
    if (action === "UPDATE") {
      
      // 💥 হ্যাকার প্রটেকশন: Native Token Decode 💥
      const token = req.cookies.get("zenex_token")?.value;
      if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });
      
      let userRole = "user";
      try {
        const payloadBase64 = token.split('.')[1];
        // 💥 CRASH FIX: Node.js Safe Base64 Decode
        const decodedString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
        const decodedPayload = JSON.parse(decodedString);
        userRole = decodedPayload.role;
      } catch (err) {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token" }, { status: 403 });
      }

      if (userRole !== "admin") {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Only admins can change settings!" }, { status: 403 });
      }

      const updated = await PaymentSetting.findOneAndUpdate(
        { type: "global" },
        // 💥 NEW: isManualWithdrawOpen & binanceAutoPayActive Updated 💥
        { isWithdrawOpen, isManualWithdrawOpen, methods, binanceAutoPayActive },
        { new: true, upsert: true }
      );
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}