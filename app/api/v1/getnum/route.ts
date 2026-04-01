// app/api/v1/getnum/route.ts
import { NextResponse } from "next/server";
import connectToDatabase from "../../../../lib/mongodb"; // ডাটাবেস পাথ (প্রয়োজনে ঠিক করে নেবেন)
import User from "../../../../models/User";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ১. ইউজারের পাঠানো API Key (mapikey) রিসিভ করা
    const apiKey = req.headers.get("mapikey");
    
    if (!apiKey) {
      return NextResponse.json({ meta: { status: "error" }, message: "Unauthorized: Missing mapikey in headers" }, { status: 401 });
    }

    await connectToDatabase();

    // ২. ডাটাবেসে চেক করা এই Key টি কার এবং তার একাউন্ট ঠিক আছে কি না
    const user = await User.findOne({ apiKey });
    
    if (!user) {
      return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    }
    if (!user.isApiActive) {
      return NextResponse.json({ meta: { status: "error" }, message: "API Access is Disabled by Admin" }, { status: 403 });
    }
    if (user.status !== "active") {
      return NextResponse.json({ meta: { status: "error" }, message: "Your account is not active" }, { status: 403 });
    }
    // নাম্বার নেওয়ার জন্য অন্তত একটি OTP এর সমপরিমাণ ব্যালেন্স থাকতে হবে
    if (user.balance < user.otpRate) {
      return NextResponse.json({ meta: { status: "error" }, message: "Insufficient Balance" }, { status: 400 });
    }

    // ৩. ইউজারের পাঠানো বডি (Range, Country etc) পড়া
    const body = await req.json().catch(() => ({}));

    // ৪. আমাদের মেইন MNIT প্রোভাইডারের কাছে রিকোয়েস্ট পাঠানো (Cloudflare Bypass সহ)
    const REAL_API_KEY = "M_7VX25KAJI"; 
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
      method: "POST",
      headers: {
        "mapikey": REAL_API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", // Bypass Trick
        "Accept": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // ৫. নাম্বার পেলে ডাটাবেসে সেভ করা (যাতে ওয়েব ড্যাশবোর্ডে শো করে)
    if (data.meta?.status === "success") {
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
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

    // ৬. ইউজারকে হুবহু MNIT এর ফরমেটে রেসপন্স দিয়ে দেওয়া
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error("API /v1/getnum Error:", error);
    return NextResponse.json({ meta: { status: "error" }, message: "Internal Server Error" }, { status: 500 });
  }
}