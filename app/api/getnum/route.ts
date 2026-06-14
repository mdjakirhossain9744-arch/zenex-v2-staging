import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

// Vercel/Next.js ক্যাশ যেন না ধরে তার জন্য
export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // 💥 ADDED 'email' to identify which user is taking the number
    const { range, is_national, remove_plus, email } = body;

    // 🛡️ SECURITY CHECK: Email না থাকলে নাম্বার দেওয়া হবে না
    if (!email) {
       return NextResponse.json({ error: "Unauthorized: User email is required" }, { status: 401 });
    }

    // 💥 CONNECT DATABASE 💥
    await connectToDatabase();

    // Verify if user is Active and API is enabled (Optional but recommended for Web Users too)
    const user = await User.findOne({ email: new RegExp(`^${email.trim()}$`, 'i') }).lean();
    if (!user || user.status !== "active") {
        return NextResponse.json({ error: "Account Inactive or Blocked" }, { status: 403 });
    }

    const API_KEY = "M_7VX25KAJI";

    // 💥 Cloudflare / WAF Bypass (Android Mobile App Dalvik Trick) 💥
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
      method: "POST",
      headers: {
        "mapikey": API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", 
        "Accept": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        range: range || "23276345XXX",
        is_national: is_national || false,
        remove_plus: remove_plus || false,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
       const errorText = await response.text(); 
       console.error(`Provider Error [${response.status}]:`, errorText);
       return NextResponse.json({ error: `Provider Blocked Request (Status: ${response.status})` }, { status: 400 });
    }

    const data = await response.json();

    if (data.meta?.status !== "success" || !data.data) {
      return NextResponse.json(
        { error: data.message || "Failed to get number from API" },
        { status: 400 }
      );
    }

    // 💥 THE MASTERPIECE FIX: SAVE TO DATABASE SO OTP SYNC CAN FIND IT 💥
    try {
        const todayStr = getUTCDateString();
        const newOrder = new Order({
            userEmail: user.email, // Exact match from DB
            searchNumber: data.data.full_number,
            displayNumber: data.data.number || `+${data.data.full_number}`,
            country: data.data.country || "Unknown",
            operator: data.data.operator || "Any",
            status: "WAIT",
            dateString: todayStr,
            expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) // ২ দিনের গ্যারান্টি
        });
        await newOrder.save();
    } catch (dbError) {
        console.error("Order Save Error in Web API:", dbError);
        // Even if saving fails, we don't crash the user experience, but log it.
    }

    return NextResponse.json({
      success: true,
      data: data.data,
    });

  } catch (error: any) {
    console.error("Get Number API Error:", error.message);
    return NextResponse.json(
      { error: "Internal Server Error or Provider Timeout" },
      { status: 500 }
    );
  }
}