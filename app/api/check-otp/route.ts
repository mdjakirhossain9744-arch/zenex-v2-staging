import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 Anti-Spam Firewall (Rate Limiter) 💥
const ipMap = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 5000; 
const MAX_REQUESTS = 15; 

export async function GET(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown_ip";
    const now = Date.now();
    const ipData = ipMap.get(ip) || { count: 0, startTime: now };

    if (now - ipData.startTime > RATE_LIMIT_WINDOW) {
      ipData.count = 1;
      ipData.startTime = now;
    } else {
      ipData.count++;
      if (ipData.count > MAX_REQUESTS) {
        return NextResponse.json({ success: false, error: "SPAM DETECTED: You have been temporarily blocked." }, { status: 429 });
      }
    }
    ipMap.set(ip, ipData);

    // 💥 NEW V4 ARCHITECTURE: Direct DB Query (Bypassing Localhost HTTP Hop) 💥
    // এতে 500 Error আসবে না এবং ডেটা রকেটের গতিতে ফেচ হবে!
    await connectToDatabase();
    
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: twentyMinutesAgo }
    })
    .select("_id displayNumber searchNumber otp fullMessage country operator updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

    let expandedOtps: any[] = [];

    recentOrders.forEach(order => {
        const d = new Date(order.updatedAt || order.createdAt || Date.now());
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formattedDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        
        const numberClean = String(order.displayNumber || order.searchNumber || "").replace(/\D/g, "");
        const baseNid = "ZX_" + order._id.toString().substring(0, 10).toUpperCase();

        // 💥 Zero-Loss Multi-OTP Expansion 💥
        if (order.fullMessage && order.fullMessage.includes("_||_")) {
            const msgsArray = order.fullMessage.split("_||_").map((m: string) => m.trim()).filter(Boolean);
            msgsArray.forEach((msg: string, idx: number) => {
                expandedOtps.push({ nid: `${baseNid}_${idx}`, number: numberClean, otp: msg, country: order.country || "Unknown", operator: order.operator || "Any", created_at: formattedDate });
            });
        } else {
            expandedOtps.push({ nid: baseNid, number: numberClean, otp: order.fullMessage || order.otp || "", country: order.country || "Unknown", operator: order.operator || "Any", created_at: formattedDate });
        }
    });

    const validOtps = expandedOtps.filter(o => o.otp && o.otp.trim() !== "" && !["waiting...", "pending", "null"].includes(o.otp.toLowerCase()));

    return NextResponse.json({ success: true, otps: validOtps }, { status: 200 });

  } catch (error: any) {
    console.error("Check OTP Error:", error.message);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}