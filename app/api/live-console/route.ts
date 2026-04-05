import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import Order from "../../../models/Order"; 

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// 💥 SERVER-SIDE IN-MEMORY CACHE (Database Protector) 💥
let cachedData: any = null;
let lastFetchTime = 0;
const CACHE_TTL = 4000; // 4 seconds cache

const getServiceName = (message: string) => {
  const msgLower = (message || "").toLowerCase();
  const popularApps = ['facebook', 'whatsapp', 'telegram', 'instagram', 'google', 'tiktok', 'apple', 'amazon', 'netflix', 'yahoo', 'twitter', 'paypal', 'discord', 'tinder', 'uber', 'viber', 'line', 'coinw'];
  for (const app of popularApps) {
    if (msgLower.includes(app)) return app.toUpperCase();
  }
  if (msgLower.includes(" fb ")) return "FACEBOOK";
  if (msgLower.includes(" ig ")) return "INSTAGRAM";
  if (msgLower.includes(" wa ")) return "WHATSAPP";
  if (msgLower.includes(" tg ")) return "TELEGRAM";
  return "OTHER";
};

export async function GET(req: NextRequest) {
  try {
    // 💥 1. CACHE INTERCEPTOR: Serve instantly from RAM to save DB 💥
    if (cachedData && (Date.now() - lastFetchTime < CACHE_TTL)) {
      return NextResponse.json(cachedData);
    }

    await connectToDatabase();

    const twentyMinsAgo = Date.now() - 20 * 60 * 1000; 

    // 💥 2. OPTIMIZED DB QUERY: Only local data, super fast 💥
    const localOrders = await Order.find({ status: { $in: ["DONE", "Success"] } })
      .sort({ updatedAt: -1 }) // Master Rule 7: Sort by OTP arrival time
      .select("searchNumber number fullMessage otp country operator createdAt updatedAt") 
      .limit(100)
      .lean();

    const localLogs = localOrders.map((log: any) => ({
      id: log._id.toString(),
      number: log.searchNumber || log.number || "",
      otp: log.fullMessage || log.otp || "",
      country: log.country || "BD",
      operator: log.operator || "Other",
      service: getServiceName(log.fullMessage || log.otp),
      createdAt: new Date(log.updatedAt || log.createdAt).getTime()
    }));

    // 💥 3. PROCESS GRAPH & CARRIER DATA 💥
    const recent20Mins = localLogs.filter((log: any) => log.createdAt >= twentyMinsAgo);

    const appCounts: Record<string, number> = {};
    const carrierCounts: Record<string, number> = {};

    recent20Mins.forEach((log: any) => {
      appCounts[log.service] = (appCounts[log.service] || 0) + 1;
      carrierCounts[log.operator] = (carrierCounts[log.operator] || 0) + 1;
    });

    let graphData = Object.keys(appCounts)
      .map(key => ({ name: key, value: appCounts[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8); 

    let pad = " ";
    while (graphData.length < 8) {
      graphData.push({ name: pad, value: 0 });
      pad += " ";
    }

    const carrierData = Object.keys(carrierCounts)
      .map(key => ({ name: key, value: carrierCounts[key] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // 💥 4. SAVE TO RAM CACHE AND RETURN 💥
    cachedData = { 
      success: true, 
      logs: localLogs, 
      graph: graphData,
      carrier: carrierData
    };
    lastFetchTime = Date.now();

    return NextResponse.json(cachedData);

  } catch (error: any) {
    console.error("Live Console Critical Error:", error.message);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}