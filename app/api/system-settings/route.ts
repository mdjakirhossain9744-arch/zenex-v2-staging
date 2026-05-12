import { NextResponse } from "next/server";
// 💥 পাথ পারফেক্টলি ফিক্স করা হলো (২টি ../) 💥
import connectToDatabase from "../../lib/mongodb"; 
import mongoose from "mongoose";

// 💥 THE MAGIC FIX: Next.js কে ক্যাশ (Cache) করতে বারণ করা হলো 💥
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();
    
    // 💥 ম্যাজিক ফিক্স: `db` এর বদলে সরাসরি Mongoose connection থেকে collection কল করা হলো 💥
    // এর ফলে Database missing এরর আর আসবে না।
    const collection = mongoose.connection.collection("system_settings");
    const settings = await collection.findOne({ type: "global" });
    
    // যদি না থাকে, তবে ডিফল্ট রেসপন্স দিবে 
    if (!settings) {
      return NextResponse.json({ type: "global", maintenance: false, globalRate: 0.50 });
    }
    
    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("System Settings GET Error:", error.message);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { maintenance, globalRate } = await req.json();
    
    await connectToDatabase();
    
    // 💥 ম্যাজিক ফিক্স: সরাসরি collection এ আপডেট 💥
    const collection = mongoose.connection.collection("system_settings");
    
    await collection.updateOne(
      { type: "global" },
      { $set: { maintenance: maintenance, globalRate: Number(globalRate) } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "System updated successfully!" });
  } catch (error: any) {
    console.error("System Settings POST Error:", error.message);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}