import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb"; 
import User from "../../../../models/User";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 ম্যাজিক: ইন-মেমোরি কিউ (Queue/Serial) সিস্টেম 💥
// এটি একসাথে আসা রিকোয়েস্টগুলোকে সিরিয়ালে দাঁড় করিয়ে দেবে
const userQueues = new Map<string, Promise<void>>();

async function runSequentially<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prevTask = userQueues.get(key) || Promise.resolve();
  let releaseLock: () => void;
  const nextTask = new Promise<void>((resolve) => { releaseLock = resolve; });
  
  // নতুন রিকোয়েস্টকে লাইনের পিছনে দাঁড় করানো হলো
  userQueues.set(key, prevTask.then(() => nextTask));
  
  // আগের জনের কাজ শেষ হওয়া পর্যন্ত অপেক্ষা করবে (বট কোনো এরর খাবে না, জাস্ট লোডিংয়ে থাকবে)
  await prevTask; 
  
  try {
    return await task(); // যখন নিজের সিরিয়াল আসবে, তখন কাজ করবে
  } finally {
    releaseLock!(); // নিজের কাজ শেষ, এবার পিছনের জনকে সুযোগ দেবে
    if (userQueues.get(key) === nextTask) {
      userQueues.delete(key); // লাইন ফাঁকা হলে মেমোরি পরিষ্কার করে দেবে
    }
  }
}

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    
    // API Key Validation
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ meta: { status: "error" }, message: "Invalid or Missing mapikey" }, { status: 401 });
    }

    const cleanApiKey = apiKey.trim();
    
    // রিকোয়েস্ট বডি আগেই পড়ে নিচ্ছি যাতে সিরিয়ালে দাঁড়িয়ে থাকতে সমস্যা না হয়
    const body = await req.json().catch(() => ({}));

    // 💥 ম্যাজিক লজিকের শুরু: এখান থেকে সব কাজ সিরিয়ালে (১টা ১টা করে) হবে 💥
    return await runSequentially(cleanApiKey, async () => {
      
      await connectToDatabase();

      const user = await User.findOne({ apiKey: cleanApiKey });
      if (!user) return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
      if (!user.isApiActive) return NextResponse.json({ meta: { status: "error" }, message: "API Access is Disabled" }, { status: 403 });
      if (user.status !== "active") return NextResponse.json({ meta: { status: "error" }, message: "Account is not active" }, { status: 403 });

      // 💥 Max 100 Pending Numbers Logic 💥
      const MAX_ACTIVE_NUMBERS = 100; 
      const activeOrdersCount = await Order.countDocuments({ userEmail: user.email, status: "WAIT" });

      if (activeOrdersCount >= MAX_ACTIVE_NUMBERS) {
        return NextResponse.json({ 
          meta: { status: "error" }, 
          message: "You have reached the limit of 100 active numbers. Wait for OTPs or cancel some." 
        }, { status: 429 });
      }

      const REAL_API_KEY = "M_7VX25KAJI"; 

      // M-Net API তে রিকোয়েস্ট (যেহেতু সিরিয়ালে কাজ হচ্ছে, M-Net এ স্প্যাম হবে না)
      const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
        method: "POST",
        headers: {
          "mapikey": REAL_API_KEY,
          "Content-Type": "application/json",
          "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)",
          "Accept": "application/json",
          "Connection": "keep-alive"
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.meta?.status === "success") {
        // ✅ Changed to strictly UTC Date string
        const utcDate = new Date();
        const todayStr = `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
        
        const newOrder = new Order({
          userEmail: user.email,
          searchNumber: data.data.full_number,
          displayNumber: data.data.number || `+${data.data.full_number}`,
          country: data.data.country || "Unknown",
          operator: data.data.operator || "Any",
          status: "WAIT",
          dateString: todayStr
        });
        await newOrder.save();
      }

      return NextResponse.json(data, { status: response.status });
    });

  } catch (error: any) {
    console.error("GETNUM API ERROR:", error.message);
    return NextResponse.json({ meta: { status: "error" }, message: "Internal Server Error" }, { status: 500 });
  }
}