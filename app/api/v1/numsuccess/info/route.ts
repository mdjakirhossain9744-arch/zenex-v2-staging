import { NextResponse } from "next/server";
import connectToDatabase from "../../../../lib/mongodb"; 
import User from "../../../../../models/User";
import Order from "../../../../../models/Order";

export const dynamic = "force-dynamic";

// 💥 ANTI-SPAM (Rate Limit): ১ সেকেন্ডে ১ বারের বেশি হিট করতে পারবে না 💥
const rateLimitMap = new Map<string, number>();

// 💥 ANTI-CRASH (Micro-Cache): M-Net এর ডাটা ৩ সেকেন্ডের জন্য RAM-এ সেভ থাকবে 💥
let globalMnetCache: any = null;
let mnetLastFetchTime = 0;
const MNET_CACHE_TTL = 3000; // 3 seconds

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    
    // ১. API Key Validation
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ meta: { status: "error" }, message: "Missing or Invalid mapikey in headers" }, { status: 401 });
    }
    const cleanApiKey = apiKey.trim();

    // ২. DDOS & SPAM PROTECTION
    const now = Date.now();
    const lastRequestTime = rateLimitMap.get(cleanApiKey);
    if (lastRequestTime && (now - lastRequestTime < 1000)) { 
        return NextResponse.json(
            { meta: { status: "error", code: 429 }, message: "Too Many Requests. Please wait 1 second between requests." }, 
            { status: 429 }
        );
    }
    rateLimitMap.set(cleanApiKey, now);

    await connectToDatabase();
    const user = await User.findOne({ apiKey: cleanApiKey }).lean();
    if (!user) return NextResponse.json({ meta: { status: "error" }, message: "Invalid API Key" }, { status: 401 });
    if (!user.isApiActive) return NextResponse.json({ meta: { status: "error" }, message: "API Access Disabled" }, { status: 403 });

    const REAL_API_KEY = "M_7VX25KAJI"; 
    
    // 💥 ৩. M-NET FETCH WITH MICRO-CACHE & TIMEOUT (বটের জন্য OTP আনা) 💥
    if (!globalMnetCache || (now - mnetLastFetchTime > MNET_CACHE_TTL)) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // ৮ সেকেন্ডে হ্যাং প্রোটেকশন

        try {
            const response = await fetch(`https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${now}`, {
              method: "GET",
              headers: {
                "mapikey": REAL_API_KEY,
                "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", 
                "Accept": "application/json",
                "Connection": "keep-alive"
              },
              cache: "no-store",
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
                globalMnetCache = await response.json();
                mnetLastFetchTime = now;
            }
        } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                return NextResponse.json({ meta: { status: "error" }, message: "Provider Timeout. Try again." }, { status: 504 });
            }
            if (!globalMnetCache) throw fetchError; 
        }
    }

    const data = globalMnetCache;
    let safeUserOtps: any[] = [];

    if (data?.meta?.status === "success" && data?.data?.otps) {
      const liveOtps = Array.isArray(data.data.otps) ? data.data.otps : [];
      
      if (liveOtps.length > 0) {
        // ৪. ইউজারের পেন্ডিং অর্ডারগুলো চেক করে M-Net এর ডাটার সাথে মেলানো
        const pendingOrders = await Order.find({ userEmail: user.email, status: "WAIT" }).lean();

        for (const order of pendingOrders) {
          const cleanSearchNumber = String(order.searchNumber).replace(/\D/g, ""); 
          const last6Digits = cleanSearchNumber.slice(-6); 

          const matchedOtpObj = liveOtps.find((m: any) => {
             if(!m.number) return false;
             return String(m.number).replace(/\D/g, "").endsWith(last6Digits);
          });

          if (matchedOtpObj) {
             const incomingMsg = (matchedOtpObj.otp || "").toLowerCase();
             const isFreeService = incomingMsg.includes("whatsapp") || incomingMsg.includes("wa.me") || incomingMsg.includes("telegram") || incomingMsg.includes("t.me");

             // 💥 ৫. STATIC RATE BUG FIX (টাকার হিসাব লক করা) 💥
             let currentOtpCost = 0;
             let currentOtpCommission = 0;
             let agentToUpdate = null;

             if (!isFreeService) {
                currentOtpCost = Number(user.otpRate) || 0.50;
                if (user.agentEmail) {
                   agentToUpdate = await User.findOne({
                     $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                     role: "agent"
                   }).lean();
                   if (agentToUpdate) {
                      const agentRate = Number(agentToUpdate.agentMaxRate) || 0.70;
                      const commission = Number((agentRate - currentOtpCost).toFixed(2));
                      if (commission > 0) currentOtpCommission = commission;
                   }
                }
             }

             // ডাটাবেস আপডেট এবং ১০ দিনের জন্য সেভ রাখা
             const updatedOrder = await Order.findOneAndUpdate(
               { _id: order._id, status: "WAIT" },
               { 
                 $set: { 
                   status: "DONE", 
                   otp: matchedOtpObj.otp, 
                   fullMessage: matchedOtpObj.otp,
                   expireAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) 
                 },
                 $inc: { orderCost: currentOtpCost, orderCommission: currentOtpCommission }
               },
               { new: true }
             );

             // ইউজার ও এজেন্টের মেইন ব্যালেন্সে টাকা যোগ করা
             if (updatedOrder) {
                if (currentOtpCost > 0) {
                  await User.updateOne({ _id: user._id }, { $inc: { balance: currentOtpCost } });
                }
                if (currentOtpCommission > 0 && agentToUpdate) {
                  await User.updateOne({ _id: agentToUpdate._id }, { $inc: { agentEarning: currentOtpCommission, balance: currentOtpCommission } });
                }
             }
          }
        }

        // ৬. Data Privacy Logic: অন্য কারো ওটিপি যেন বটের কাছে না যায়
        const userRecentOrders = await Order.find({ 
          userEmail: user.email, 
          status: { $in: ["WAIT", "DONE"] } 
        }).sort({ _id: -1 }).limit(100).lean();

        safeUserOtps = liveOtps.filter((m: any) => {
           if(!m.number) return false;
           return userRecentOrders.some(order => {
             const cleanSearchNum = String(order.searchNumber).replace(/\D/g, "");
             return String(m.number).replace(/\D/g, "").endsWith(cleanSearchNum.slice(-6));
           });
        });
      }
    }

    // ৭. সিকিউরড রেসপন্স বটের কাছে পাঠানো হলো
    const secureResponse = {
      meta: data?.meta || { status: "success", code: 200 },
      data: { otps: safeUserOtps }
    };

    return NextResponse.json(secureResponse, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500 });
  }
}