import { NextResponse } from "next/server";
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
      const liveOtps = Array.isArray(data.data.otps) ? data.data.otps : [];
      if (liveOtps.length === 0) return NextResponse.json(data, { status: response.status });

      const pendingOrders = await Order.find({ userEmail: user.email, status: "WAIT" });

      for (const order of pendingOrders) {
        const cleanSearchNumber = String(order.searchNumber).replace(/\D/g, ""); 
        const last6Digits = cleanSearchNumber.slice(-6); 

        const matchedOtpObj = liveOtps.find((m: any) => {
           if(!m.number) return false;
           return String(m.number).replace(/\D/g, "").endsWith(last6Digits);
        });

        if (matchedOtpObj) {
           // 💥 ১. Atomic Status Update (Double Spending হ্যাক প্রটেকশন) 💥
           const updatedOrder = await Order.findOneAndUpdate(
             { _id: order._id, status: "WAIT" },
             { $set: { status: "DONE", otp: matchedOtpObj.otp, fullMessage: matchedOtpObj.otp } },
             { new: true }
           );

           // যদি আপডেট সফল হয় (অর্থাৎ আগে DONE হয়নি)
           if (updatedOrder) {
              const incomingMsg = (matchedOtpObj.otp || "").toLowerCase();
              const isFreeService = incomingMsg.includes("whatsapp") || incomingMsg.includes("wa.me") || incomingMsg.includes("telegram") || incomingMsg.includes("t.me");

              // 💥 ২. WhatsApp/Telegram জিরো লস প্রটেকশন 💥
              if (!isFreeService) {
                 const userRate = Number(user.otpRate) || 0.50;
                 
                 // ইউজারের ব্যালেন্স অ্যাড (Atomic)
                 await User.findByIdAndUpdate(user._id, { $inc: { balance: userRate } });

                 // 💥 ৩. Agent Auto-Commission (Bot User দের জন্যও কমিশন পাবে) 💥
                 if (user.agentEmail) {
                    const agent = await User.findOne({
                      $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                      role: "agent"
                    });
                    if (agent) {
                       const agentRate = Number(agent.agentMaxRate) || 0.70;
                       const commission = Number((agentRate - userRate).toFixed(2));
                       if (commission > 0) {
                          await User.findByIdAndUpdate(agent._id, { $inc: { agentEarning: commission } });
                       }
                    }
                 }
              }
           }
        }
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500 });
  }
}