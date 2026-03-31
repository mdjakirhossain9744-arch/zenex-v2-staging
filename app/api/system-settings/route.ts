import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    // 💥 Vercel Error Fix: TypeScript কে নিশ্চিত করা হচ্ছে যে db খালি নেই 💥
    if (!db) {
      throw new Error("Database connection is missing");
    }

    // ডাটাবেস থেকে সেটিংস বের করে আনবে
    let settings = await db.collection("system_settings").findOne({ type: "global" });
    
    if (!settings) {
      settings = { type: "global", maintenance: false, globalRate: 0.50 };
      // TypeScript error এড়ানোর জন্য 'as any' ব্যবহার করা হলো
      await db.collection("system_settings").insertOne(settings as any);
    }
    
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { maintenance, globalRate } = await req.json();
    await connectToDatabase();
    const db = mongoose.connection.db;

    // 💥 Vercel Error Fix 💥
    if (!db) {
      throw new Error("Database connection is missing");
    }

    await db.collection("system_settings").updateOne(
      { type: "global" },
      { $set: { maintenance: maintenance, globalRate: Number(globalRate) } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "System updated successfully!" });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}