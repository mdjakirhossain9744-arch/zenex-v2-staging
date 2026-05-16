import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    
    const collection = mongoose.connection.collection("system_settings");
    const settings = await collection.findOne({ type: "global" });
    
    // 🔥 Added hiddenKeywords to response
    if (!settings) {
      return NextResponse.json({ type: "global", maintenance: false, globalRate: 0.50, hiddenKeywords: [] });
    }
    
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("System Settings GET Error:", error.message);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // 🔥 Extract hiddenKeywords from request body
    const { maintenance, globalRate, hiddenKeywords } = await req.json();
    
    await connectToDatabase();
    
    const collection = mongoose.connection.collection("system_settings");
    
    // 🔥 Dynamically build the update object so we don't overwrite existing values with undefined
    const updateFields: any = {};
    if (maintenance !== undefined) updateFields.maintenance = maintenance;
    if (globalRate !== undefined) updateFields.globalRate = Number(globalRate);
    if (hiddenKeywords !== undefined) updateFields.hiddenKeywords = hiddenKeywords; // Array of masked words
    
    await collection.updateOne(
      { type: "global" },
      { $set: updateFields },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "System updated successfully!" });
  } catch (error: any) {
    console.error("System Settings POST Error:", error.message);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}