import { NextResponse } from "next/server";
// 💥 পাথ ফিক্স করা হয়েছে 💥
import connectToDatabase from "../../../../../lib/mongodb"; 
import User from "../../../../../../models/User";
import Order from "../../../../../../models/Order";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    if (!apiKey) return NextResponse.json({ meta: { status: "error" }, message: "Missing mapikey in headers" }, { status: 401 });

    await connectToDatabase();

    const user = await User.findOne({ apiKey });
    if (!user) return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    if (!user.isApiActive) return NextResponse.json({ meta: { status: "error" }, message: "API Access Disabled" }, { status: 403 });

    const REAL_API_KEY = "M_7VX25KAJI"; 
    const response = await fetch(`https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${Date.now()}`, {
      method: "GET",
      headers: {
        "mapikey": REAL_API_KEY,
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", 
        "Accept": "application/json",
        "Connection": "keep-alive"
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (data.meta?.status === "success" && data.data?.otps) {
      const liveOtps = data.data.otps;
      const pendingOrders = await Order.find({ userEmail: user.email, status: "WAIT" });

      for (const order of pendingOrders) {
        const cleanSearchNumber = String(order.searchNumber).replace(/\D/g, ""); 
        const last6Digits = cleanSearchNumber.slice(-6); 

        const matchedOtpObj = liveOtps.find((m: any) => {
           if(!m.number) return false;
           return String(m.number).replace(/\D/g, "").endsWith(last6Digits);
        });

        if (matchedOtpObj) {
           order.status = "DONE";
           order.otp = matchedOtpObj.otp;
           await order.save();

           user.balance += user.otpRate; 
           await user.save();
        }
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500 });
  }
}