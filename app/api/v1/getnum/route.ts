import { NextResponse } from "next/server";
import connectToDatabase from "../../../../lib/mongodb"; 
import User from "../../../../models/User";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    if (!apiKey) return NextResponse.json({ meta: { status: "error" }, message: "Missing mapikey in headers" }, { status: 401 });

    await connectToDatabase();

    const user = await User.findOne({ apiKey });
    if (!user) return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    if (!user.isApiActive) return NextResponse.json({ meta: { status: "error" }, message: "API Access Disabled" }, { status: 403 });
    if (user.status !== "active") return NextResponse.json({ meta: { status: "error" }, message: "Account not active" }, { status: 403 });

    // 💥 ব্যালেন্স চেকের লজিক রিমুভ করা হয়েছে। এখন 0 ব্যালেন্স থাকলেও বট নাম্বার নিতে পারবে! 💥

    const body = await req.json().catch(() => ({}));
    const REAL_API_KEY = "M_7VX25KAJI"; 

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

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500 });
  }
}