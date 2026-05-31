import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb"; 
import User from "../../../../models/User";
import Order from "../../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 PURE UTC TIMEZONE 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    }

    const cleanApiKey = apiKey.trim();
    const body = await req.json().catch(() => ({}));

    await connectToDatabase();
    
    // 💥 SECURITY: User Validation 💥
    const user = await User.findOne({ apiKey: cleanApiKey }).lean();
    if (!user) return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    if (!user.isApiActive) return NextResponse.json({ meta: { status: "error" }, message: "API Disabled" }, { status: 403 });
    if (user.status !== "active") return NextResponse.json({ meta: { status: "error" }, message: "Account Inactive" }, { status: 403 });

    const REAL_API_KEY = "M_7VX25KAJI"; 

    // 💥 ANTI-HANG FIX: 5 Sec Timeout 💥
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); 

    let response;
    try {
        response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
          method: "POST",
          headers: {
            "mapikey": REAL_API_KEY,
            "Content-Type": "application/json",
            "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", // MNIT Original User Agent
            "Accept": "application/json",
            "Connection": "keep-alive"
          },
          body: JSON.stringify(body),
          cache: "no-store",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        return NextResponse.json({ meta: { status: "error" }, message: "Provider is slow. Try again." }, { status: 504 });
    }

    const data = await response.json();

    // 💥 ASYNC BACKGROUND SAVE (Zero User Wait Time) 💥
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
        expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // 2 Days Auto Expiration
      });
      newOrder.save().catch((e:any) => console.error("Order Save Error:", e));
    }

    return NextResponse.json(data, { status: response.status || 200 });

  } catch (error: any) {
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500 });
  }
}