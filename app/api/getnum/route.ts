import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { range, email } = body; // is_national, remove_plus are obsolete now

    if (!email) {
        const token = request.cookies.get("zenex_token")?.value;
        if (token) {
            try {
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = JSON.parse(atob(payloadBase64));
                email = decodedPayload.email;
            } catch (e) {
                console.error("JWT Decode error in getnum");
            }
        }
    }

    if (!email) {
       return NextResponse.json({ error: "Unauthorized: User Session Expired or Email Missing" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: new RegExp(`^${email.trim()}$`, 'i') }).lean();
    if (!user || user.status !== "active") {
        return NextResponse.json({ error: "Account Inactive or Blocked" }, { status: 403 });
    }

    const API_KEY = "MK2447V3313";
    // 🔥 Remove "X" or "XXX" to get the exact `rid` for the new API
    const rid = (range || "22501").replace(/x/gi, ''); 

    const response = await fetch("https://api.2oo9.cloud/MXS47FLFX0U/tness/@public/api/getnum", {
      method: "POST",
      headers: {
        "mauthapi": API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12)", 
        "Accept": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({ rid }),
      cache: "no-store",
    });

    if (!response.ok) {
       const errorText = await response.text(); 
       console.error(`Provider Error [${response.status}]:`, errorText);
       return NextResponse.json({ error: `Provider Blocked Request (Status: ${response.status})` }, { status: 400 });
    }

    const data = await response.json();

    if (data.meta?.code !== 200 || !data.data) {
      return NextResponse.json(
        { error: data.message || "Failed to get number from Provider. Out of Stock?" },
        { status: 400 }
      );
    }

    let savedOrderId = null;

    try {
        const todayStr = getUTCDateString();
        const newOrder = new Order({
            userEmail: user.email, 
            // 💥 FIX: New API uses `no_plus_number` for search and `full_number` for display
            searchNumber: data.data.no_plus_number,
            displayNumber: data.data.full_number, 
            country: data.data.country || "Unknown",
            operator: data.data.operator || "Any",
            status: "WAIT",
            dateString: todayStr,
            expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) 
        });
        const savedRecord = await newOrder.save();
        savedOrderId = savedRecord._id; 
    } catch (dbError) {
        console.error("Order Save Error in Web API:", dbError);
    }

    // Return the response in legacy format so Frontend doesn't break
    return NextResponse.json({
      success: true,
      data: {
          copy: data.data.full_number,
          full_number: data.data.no_plus_number,
          number: data.data.full_number,
          country: data.data.country,
          iso: "Unknown",
          operator: data.data.operator,
          status: "pending"
      },
      orderId: savedOrderId 
    });

  } catch (error: any) {
    console.error("Get Number API Error:", error.message);
    return NextResponse.json(
      { error: "Internal Server Error or Provider Timeout" },
      { status: 500 }
    );
  }
}