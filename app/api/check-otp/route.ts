import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import redis from "../../lib/redis"; // 💥 REDIS SHIELD FOR BOTS 💥

export const dynamic = "force-dynamic";

// 💥 Anti-Spam Firewall (Rate Limiter for Bad Bots) 💥
const ipMap = new Map<string, { count: number, startTime: number }>();
const RATE_LIMIT_WINDOW = 5000; 
const MAX_REQUESTS = 50; // 💥 বটের জন্য লিমিট বাড়ানো হলো (আগে 15 ছিল, এখন 5 সেকেন্ডে 50 বার হিট করতে পারবে) 💥

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

    // 💥 1. BOTS HIT REDIS ONLY (Zero Database Lag) 💥
    const cacheKey = "global_recent_otps_cache_v2";
    const cachedOtps = await redis.get(cacheKey);

    if (cachedOtps) {
        return new NextResponse(cachedOtps, { 
            status: 200, 
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } 
        });
    }

    // 💥 2. IF CACHE EMPTY, SERVER FETCHES FOR ALL BOTS AT ONCE 💥
    await connectToDatabase();
    
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: twentyMinutesAgo }
    })
    .select("_id displayNumber searchNumber otp fullMessage country operator updatedAt createdAt")
    .sort({ updatedAt: -1 })
    .lean(); 
    // 💥 THE BUG IS DEAD: .limit(100) Removed! Now it supports unlimited bot numbers 💥

    let expandedOtps: any[] = [];

    recentOrders.forEach(order => {
        const d = new Date(order.updatedAt || order.createdAt || Date.now());
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formattedDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
        
        const numberClean = String(order.displayNumber || order.searchNumber || "").replace(/\D/g, "");
        const baseNid = "ZX_" + order._id.toString().substring(0, 10).toUpperCase();

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

    const responsePayload = JSON.stringify({ success: true, otps: validOtps });

    // 💥 3. SHIELD ACTIVATED: Hold Data in RAM for 2 seconds 💥
    // Even if 20,000 bots hit this URL, MongoDB only runs the query ONCE every 2 seconds.
    await redis.setex(cacheKey, 2, responsePayload);

    return new NextResponse(responsePayload, { 
        status: 200, 
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } 
    });

  } catch (error: any) {
    console.error("Check OTP Error:", error.message);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}