// app/api/v1/global-broadcast/route.ts

import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 RAM CACHING & DUPLICATE PREVENTION 💥
// আপনার টেলিগ্রাম গ্রুপে যেন একই OTP দুইবার না যায়, তার জন্য RAM-এ ID সেভ রাখা হবে
const broadcastedIds = new Set();
let lastCleanup = Date.now();

export async function GET(req: Request) {
  try {
    const mapikey = req.headers.get("mapikey");

    // 💥 STRICT SECURITY: ONLY YOUR SPECIFIC BOT CAN ACCESS THIS 💥
    const MASTER_BOT_KEY = "ZNX_A3SRB5MVV7XBIYH1809TGZDD";
    if (mapikey !== MASTER_BOT_KEY) {
      return NextResponse.json({ success: false, message: "Unauthorized! Master Key Required." }, { status: 401 });
    }

    await connectToDatabase();

    // 💥 ZERO DB LOAD: Fetch only last 2 minutes of Success Orders 💥
    // এতে ডাটাবেসের উপর 0% চাপ পড়বে। 
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: twoMinsAgo }
    }).select("_id fullMessage otp searchNumber number service updatedAt").lean();

    const selectedOtps: any[] = [];

    recentOrders.forEach((order: any) => {
        const orderId = order._id.toString();

        // ১. ডুপ্লিকেট চেকিং: যদি এই OTP আগে পাঠানো না হয়ে থাকে
        if (!broadcastedIds.has(orderId)) {
            broadcastedIds.add(orderId); // মার্ক করা হলো যে এটা পাঠানো হচ্ছে

            // 💥 THE 50% MAGIC RULE 💥
            // Math.random() 0.0 থেকে 1.0 এর মধ্যে নাম্বার দেয়। > 0.5 মানে ঠিক ~50% চান্স!
            if (Math.random() > 0.5) {
                
                // নাম্বার মাস্কিং (ঐচ্ছিক): চাইলে নাম্বারের শেষের ২-৩ টা ডিজিট X করে দিতে পারেন
                // যাতে পাবলিক ইউজাররা প্রাইভেসি নিয়ে কমপ্লেইন না করে।
                let safeNumber = String(order.searchNumber || order.number || "").replace("+", "");
                
                selectedOtps.push({
                    id: orderId,
                    number: safeNumber,
                    otp: order.otp || order.fullMessage,
                    service: order.service || "Global Service",
                    time: order.updatedAt
                });
            }
        }
    });

    // 💥 Memory Leak Prevention: প্রতি ১০ মিনিট পর পর RAM Clean হবে 💥
    if (Date.now() - lastCleanup > 10 * 60 * 1000) {
        broadcastedIds.clear();
        lastCleanup = Date.now();
    }

    return NextResponse.json({
        success: true,
        count: selectedOtps.length,
        message: "50% Live Public OTPs Fetched Successfully!",
        data: selectedOtps
    });

  } catch (error) {
    console.error("Global Broadcast API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}