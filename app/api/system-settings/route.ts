import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import mongoose from "mongoose";

// 💥 THE MAGIC FIX: Next.js কে ক্যাশ (Cache) করতে বারণ করা হলো 💥
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    
    // 💥 স্ট্রং কানেকশন চেকিং 💥
    if (mongoose.connection.readyState !== 1) {
       await mongoose.connect(process.env.MONGODB_URI as string);
    }
    
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection is missing");
    }

    // ডাটাবেস থেকে সেটিংস আনা হচ্ছে
    const settings = await db.collection("system_settings").findOne({ type: "global" });
    
    // যদি না থাকে, তবে ডিফল্ট রেসপন্স দিবে 
    if (!settings) {
      return NextResponse.json({ type: "global", maintenance: false, globalRate: 0.50 });
    }
    
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("System Settings GET Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { maintenance, globalRate } = await req.json();
    
    await connectToDatabase();
    
    if (mongoose.connection.readyState !== 1) {
       await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Database connection is missing");
    }

    await db.collection("system_settings").updateOne(
      { type: "global" },
      { $set: { maintenance: maintenance, globalRate: Number(globalRate) } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "System updated successfully!" });
  } catch (error: any) {
    console.error("System Settings POST Error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}