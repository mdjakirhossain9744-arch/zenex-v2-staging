import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb"; 
import User from "../../../../models/User";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 ম্যাজিক: ইন-মেমোরি কিউ (Queue/Serial) সিস্টেম 💥
const userQueues = new Map<string, Promise<void>>();

async function runSequentially<T>(key: string, task: () => Promise<T>): Promise<T> {
  const prevTask = userQueues.get(key) || Promise.resolve();
  let releaseLock: () => void;
  const nextTask = new Promise<void>((resolve) => { releaseLock = resolve; });
  
  userQueues.set(key, prevTask.then(() => nextTask));
  
  await prevTask; 
  
  try {
    return await task(); 
  } finally {
    releaseLock!(); 
    if (userQueues.get(key) === nextTask) {
      userQueues.delete(key); 
    }
  }
}

// 💥 PURE UTC TIMEZONE FUNCTION 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ meta: { status: "error" }, message: "Invalid or Missing mapikey" }, { status: 401 });
    }

    const cleanApiKey = apiKey.trim();
    const body = await req.json().catch(() => ({}));

    // 💥 ম্যাজিক লজিকের শুরু: এখান থেকে সব কাজ সিরিয়ালে হবে 💥
    return await runSequentially(cleanApiKey, async () => {
      
      await connectToDatabase();

      const user = await User.findOne({ apiKey: cleanApiKey }).lean();
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

      // 💥 ANTI-HANG FIX: ৩ সেকেন্ডের টাইমআউট (Queue ব্লক হওয়া ঠেকানোর জন্য) 💥
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); 

      let response;
      try {
          response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
            method: "POST",
            headers: {
              "mapikey": REAL_API_KEY,
              "Content-Type": "application/json",
              "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)",
              "Accept": "application/json",
              "Connection": "keep-alive"
            },
            body: JSON.stringify(body),
            cache: "no-store",
            signal: controller.signal // টাইমার যুক্ত করা হলো
          });
          clearTimeout(timeoutId);
      } catch (fetchError: any) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
              return NextResponse.json({ meta: { status: "error" }, message: "Provider is slow. Please try again." }, { status: 504 });
          }
          throw fetchError;
      }

      const data = await response.json();

      if (data.meta?.status === "success") {
        const todayStr = getUTCDateString();
        
        const newOrder = new Order({
          userEmail: user.email,
          searchNumber: data.data.full_number,
          displayNumber: data.data.number || `+${data.data.full_number}`,
          country: data.data.country || "Unknown",
          operator: data.data.operator || "Any",
          status: "WAIT",
          dateString: todayStr,
          // 💥 AUTO-DELETE FIX: ফেইল হলে ২ দিন (৪৮ ঘণ্টা) পর অটো মুছে যাবে 💥
          expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        });
        await newOrder.save();
      }

      return NextResponse.json(data, { status: response.status || 200 });
    });

  } catch (error: any) {
    console.error("GETNUM API ERROR:", error.message);
    return NextResponse.json({ meta: { status: "error" }, message: "Internal Server Error" }, { status: 500 });
  }
}