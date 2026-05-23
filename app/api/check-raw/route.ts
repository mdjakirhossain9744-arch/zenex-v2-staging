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
    let query = {};
    if (num) {
      // যদি নাম্বার দিয়ে সার্চ করেন, তবে শুধু ওই নাম্বারের কাঁচা ডাটা আনবে
      query = { "rawPayload.orderData.searchNumber": num };
    }

    const rawLogs = await mongoose.connection.db.collection('mnit_raw_logs')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(10) // শেষের ১০টা কাঁচা হিট দেখাবে
      .toArray();

    return NextResponse.json({
      success: true,
      totalHitsDetected: rawLogs.length,
      message: "This is the EXACT RAW DATA sent by your Provider BEFORE any processing!",
      logs: rawLogs
    });
  } catch (error) {
    return NextResponse.json({ error: "Database Error" });
  }
}