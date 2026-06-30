import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);
    const num = searchParams.get("number");

    // ডাটাবেস থেকে শুধু কাঁচা লগগুলো তুলে আনবে
    let query: any = {};
    if (num) {
      // 💥 THE X-RAY FIX: এখন Frontend এবং Fastify Worker (Provider) দুটোর লগই স্ক্যান করবে! 💥
      query = {
        $or: [
          { "rawPayload.orderData.searchNumber": num }, // Next.js Frontend Logs
          { "rawPayload.providerData.number": { $regex: num, $options: "i" } } // Fastify Background Logs
        ]
      };
    }

    // 💥 TS Error Fix: Dynamic Model (No Red Lines, 100% Safe) 💥
    const RawLog = mongoose.models.mnit_raw_logs || mongoose.model("mnit_raw_logs", new mongoose.Schema({
        timestamp: { type: Date, default: Date.now },
        rawPayload: { type: Object }
    }, { strict: false }));

    // শেষের ২০টা কাঁচা হিট দেখাবে (আগে ১০ ছিল, এখন হিস্ট্রি বেশি দেখার জন্য ২০ করে দিলাম)
    const rawLogs = await RawLog.find(query)
      .sort({ timestamp: -1 })
      .limit(20) 
      .lean();

    return NextResponse.json({
      success: true,
      totalHitsDetected: rawLogs.length,
      message: "This is the EXACT RAW DATA sent by your Provider BEFORE any processing!",
      logs: rawLogs
    });
  } catch (error: any) {
    return NextResponse.json({ error: "Database Error", details: error.message });
  }
}