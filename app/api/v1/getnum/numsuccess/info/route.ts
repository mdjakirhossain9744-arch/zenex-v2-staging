import { NextResponse } from "next/server";
import connectToDatabase from "../../../../../lib/mongodb"; 
import User from "../../../../../../models/User";
import Order from "../../../../../../models/Order";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    
    // 💥 API Key Strict Validation 💥
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ meta: { status: "error" }, message: "Missing or Invalid mapikey in headers" }, { status: 401 });
    }
    
    const cleanApiKey = apiKey.trim();

    await connectToDatabase();

    const user = await User.findOne({ apiKey: cleanApiKey });
    if (!user) return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    if (!user.isApiActive) return NextResponse.json({ meta: { status: "error" }, message: "API Access Disabled" }, { status: 403 });

    const REAL_API_KEY = "M_7VX25KAJI"; 
    
    // M-Net থেকে গ্লোবাল OTP লিস্ট আনা
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

    // 💥 ম্যাজিক ফিক্স: Data Leak Protection (ইউজারকে শুধু তার OTP দেখানোর অ্যারে) 💥
    let safeUserOtps: any[] = [];

    if (data.meta?.status === "success" && data.data?.otps) {
      const liveOtps = Array.isArray(data.data.otps) ? data.data.otps : [];
      
      if (liveOtps.length > 0) {
        // ইউজারের পেন্ডিং অর্ডারগুলো খোঁজা
        const pendingOrders = await Order.find({ userEmail: user.email, status: "WAIT" });

        for (const order of pendingOrders) {
          const cleanSearchNumber = String(order.searchNumber).replace(/\D/g, ""); 
          const last6Digits = cleanSearchNumber.slice(-6); 

          // M-Net এর লাইভ OTP থেকে ইউজারের নাম্বার ম্যাচ করানো
          const matchedOtpObj = liveOtps.find((m: any) => {
             if(!m.number) return false;
             return String(m.number).replace(/\D/g, "").endsWith(last6Digits);
          });

          if (matchedOtpObj) {
             // 💥 ১. Atomic Status Update (Double Spending Protection) 💥
             const updatedOrder = await Order.findOneAndUpdate(
               { _id: order._id, status: "WAIT" },
               { $set: { status: "DONE", otp: matchedOtpObj.otp, fullMessage: matchedOtpObj.otp } },
               { new: true }
             );

             if (updatedOrder) {
                const incomingMsg = (matchedOtpObj.otp || "").toLowerCase();
                const isFreeService = incomingMsg.includes("whatsapp") || incomingMsg.includes("wa.me") || incomingMsg.includes("telegram") || incomingMsg.includes("t.me");

                // 💥 ২. WhatsApp/Telegram জিরো লস প্রটেকশন (ফ্রি সার্ভিসে টাকা দিবে না) 💥
                if (!isFreeService) {
                   const userRate = Number(user.otpRate) || 0.50; // ডিফল্ট রেট
                   
                   // ইউজারের ব্যালেন্স অ্যাড
                   await User.findByIdAndUpdate(user._id, { $inc: { balance: userRate } });

                   // 💥 ৩. Agent Auto-Commission (Bot User দের জন্যও) 💥
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

        // 💥 Data Privacy Logic: 💥
        // বট ইউজারকে M-Net এর গ্লোবাল ডাটা না দিয়ে, শুধু তার নাম্বারগুলোর OTP দেওয়া হচ্ছে
        // আমরা ইউজারের সব রিসেন্ট অর্ডার (WAIT + DONE) চেক করে তার OTP গুলো ফিল্টার করছি
        const userRecentOrders = await Order.find({ 
          userEmail: user.email, 
          status: { $in: ["WAIT", "DONE"] } 
        }).sort({ _id: -1 }).limit(100);

        safeUserOtps = liveOtps.filter((m: any) => {
           if(!m.number) return false;
           return userRecentOrders.some(order => {
             const cleanSearchNum = String(order.searchNumber).replace(/\D/g, "");
             return String(m.number).replace(/\D/g, "").endsWith(cleanSearchNum.slice(-6));
           });
        });
      }
    }

    // 💥 সিকিউরড রেসপন্স: গ্লোবাল ডাটা হাইড করে শুধু ইউজারের ফিল্টারড ডাটা রিটার্ন করা হলো 💥
    const secureResponse = {
      meta: data.meta || { status: "success", code: 200 },
      data: {
        otps: safeUserOtps // শুধুমাত্র এই ইউজারের OTP গুলো এখানে থাকবে
      }
    };

    return NextResponse.json(secureResponse, { status: response.status });

  } catch (error: any) {
    console.error("NUMSUCCESS API ERROR:", error.message);
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500 });
  }
}