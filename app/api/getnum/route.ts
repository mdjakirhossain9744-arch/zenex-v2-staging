import { NextRequest, NextResponse } from "next/server"; // 💥 FIXED: Imported NextRequest
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

// Vercel বা Next.js ক্যাশ যেন না ধরে তার জন্য
export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

// 💥 FIXED: Changed 'Request' to 'NextRequest' to remove the red squiggly line 💥
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { range, is_national, remove_plus, email } = body;

    // 💥 THE OFFICIAL NEXT.JS WAY: Reading Cookies directly from NextRequest 💥
    if (!email) {
        // Next.js এর অফিসিয়াল request.cookies.get() মেথড (এখন আর লাল দাগ আসবে না)
        const token = request.cookies.get("zenex_token")?.value;
        
        if (token) {
            try {
                // JWT (JSON Web Token) এর স্ট্যান্ডার্ড নিয়ম অনুযায়ী পেলোড (Payload) ডিকোড করা হচ্ছে
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = JSON.parse(atob(payloadBase64));
                email = decodedPayload.email;
            } catch (e) {
                console.error("JWT Decode error in getnum");
            }
        }
    }

    // 🛡️ SECURITY CHECK: ইমেইল ছাড়া কাউকে ডাটাবেসে ঢুকতে দেওয়া হবে চিত্র
    if (!email) {
       return NextResponse.json({ error: "Unauthorized: User Session Expired or Email Missing" }, { status: 401 });
    }

    // 💥 CONNECT DATABASE 💥
    await connectToDatabase();

    // Verify User in Database
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
        { error: data.message || "Failed to get number from Provider" },
        { status: 400 }
      );
    }

    // 💥 SAVE TO DATABASE SO OUR FASTIFY BACKGROUND WORKER CAN FIND IT 💥
    try {
        const todayStr = getUTCDateString();
        const newOrder = new Order({
            userEmail: user.email, 
            searchNumber: data.data.full_number,
            displayNumber: data.data.number || `+${data.data.full_number}`,
            country: data.data.country || "Unknown",
            operator: data.data.operator || "Any",
            status: "WAIT",
            dateString: todayStr,
            expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) 
        });
        await newOrder.save();
    } catch (dbError) {
        console.error("Order Save Error in Web API:", dbError);
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