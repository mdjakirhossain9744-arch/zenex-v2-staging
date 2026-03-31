import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import mongoose from "mongoose";

export async function GET() {
  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    
    if (!db) {
      throw new Error("Database connection is missing");
    }

    // 💥 TypeScript Error Fix: ': any' যোগ করা হয়েছে 💥
    let settings: any = await db.collection("system_settings").findOne({ type: "global" });
    
    if (!settings) {
      settings = { type: "global", maintenance: false, globalRate: 0.50 };
      await db.collection("system_settings").insertOne(settings);
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