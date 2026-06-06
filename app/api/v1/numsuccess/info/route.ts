import { NextResponse } from "next/server";
import connectToDatabase from "../../../../lib/mongodb"; 
import User from "../../../../../models/User";
import Order from "../../../../../models/Order";

// 💥 PERFECT DIRECT TUNNEL (CACHE DESTROYED) 💥
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const corsHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
};

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    if (!apiKey || apiKey.trim().length < 10) {
      return NextResponse.json({ meta: { status: "error" }, message: "Missing API Key" }, { status: 401, headers: corsHeaders });
    }

    await connectToDatabase();
    const user = await User.findOne({ apiKey: apiKey.trim() }).lean();
    if (!user || !user.isApiActive) {
      return NextResponse.json({ meta: { status: "error" }, message: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const now = Date.now();
    const REAL_API_KEY = "M_7VX25KAJI"; 
    
    let mnetData = null;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); 

    try {
        // 💥 DIRECT MNIT FETCH (No manual 3000ms cache anymore!) 💥
        const response = await fetch(`https://x.mnitnetwork.com/mapi/v1/public/numsuccess/info?t=${now}`, {
          method: "GET",
          headers: { 
             "mapikey": REAL_API_KEY, 
             "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", 
             "Connection": "keep-alive",
             "Cache-Control": "no-cache"
          },
          cache: "no-store",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
            mnetData = await response.json();
        } else {
            return NextResponse.json({ meta: { status: "error" }, message: "Provider Error" }, { status: 504, headers: corsHeaders });
        }
    } catch (fetchError: any) {
        clearTimeout(timeoutId);
        return NextResponse.json({ meta: { status: "error" }, message: "Provider Timeout" }, { status: 504, headers: corsHeaders });
    }

    const rawOtps = mnetData?.data?.otps;
    const liveOtps = Array.isArray(rawOtps) ? rawOtps : []; 
    let userSpecificOtps: any[] = [];

    if (liveOtps.length > 0) {
        const liveNumbers = liveOtps.map((o: any) => String(o.number).replace(/\D/g, ""));
        
        const matchedOrders = await Order.find({
            userEmail: user.email,
            status: { $in: ["WAIT", "DONE"] },
            $expr: {
              $in: [
                { $substr: ["$searchNumber", { $subtract: [{ $strLenCP: "$searchNumber" }, 6] }, 6] },
                liveNumbers.map((n: string) => n.slice(-6))
              ]
            }
        }).lean();

        for (const order of matchedOrders) {
            const cleanSearchNum = String(order.searchNumber).replace(/\D/g, "");
            const last6 = cleanSearchNum.slice(-6);

            const matchedOtpObj = liveOtps.find((m: any) => String(m.number).replace(/\D/g, "").endsWith(last6));

            if (matchedOtpObj) {
                // 💥 BRANDING MAGIC 💥
                const customOtpObj = {
                    ...matchedOtpObj,
                    nid: matchedOtpObj.nid ? matchedOtpObj.nid.replace(/^M_/i, 'ZX_') : matchedOtpObj.nid
                };

                userSpecificOtps.push(customOtpObj);

                const incomingMsg = (matchedOtpObj.otp || "").trim();
                const incomingMatch = incomingMsg.match(/\b\d{4,8}\b/);
                const incomingCode = incomingMatch ? incomingMatch[0] : incomingMsg; 

                const existingMsgs = order.fullMessage ? order.fullMessage.split(" _||_ ") : [];
                const alreadyExists = existingMsgs.some((msg: string) => {
                    const match = msg.match(/\b\d{4,8}\b/);
                    const code = match ? match[0] : msg.trim();
                    return code === incomingCode;
                });

                if (alreadyExists) continue;

                const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || incomingMsg.toLowerCase().includes("telegram") || incomingMsg.toLowerCase().includes("t.me");
                
                let otpCost = isFreeService ? 0 : (Number(user.otpRate) || 0.50);
                let otpCommission = 0;
                let agentId = null;

                if (!isFreeService && user.agentEmail) {
                   const agent = await User.findOne({ 
                      $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                      role: "agent" 
                   }).lean();
                   
                   if (agent) {
                      agentId = agent._id;
                      const agentRate = Number(agent.agentMaxRate) || 0.70;
                      otpCommission = Math.max(0, Number((agentRate - otpCost).toFixed(2)));
                   }
                }

                let regexStr = /^\d+$/.test(incomingCode) ? `\\b${incomingCode}\\b` : incomingCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // 💥 DB Update: This ensures Panel syncs beautifully 💥
                const updatedOrder = await Order.findOneAndUpdate(
                   { _id: order._id, fullMessage: { $not: new RegExp(regexStr) } },
                   { 
                     $set: { 
                       status: "DONE", 
                       otp: incomingCode, 
                       fullMessage: order.fullMessage ? order.fullMessage + " _||_ " + incomingMsg : incomingMsg,
                       expireAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) 
                     },
                     $inc: { orderCost: otpCost, orderCommission: otpCommission }
                   },
                   { new: true }
                );

                if (updatedOrder && otpCost > 0) {
                   const updatedUser = await User.findOneAndUpdate(
                       { _id: user._id }, 
                       { $inc: { balance: otpCost } },
                       { new: true }
                   );

                   if (otpCommission > 0 && agentId) {
                      await User.updateOne({ _id: agentId }, { $inc: { agentEarning: otpCommission, balance: otpCommission } });
                   }

                   if (updatedUser && updatedUser.autoPayEnabled && updatedUser.balance >= 100) {
                      triggerBinanceAutoPay(updatedUser).catch(err => console.log("AutoPay error:", err));
                   }
                }
            }
        }
    }

    return NextResponse.json({
      meta: mnetData?.meta || { status: "success", code: 200 },
      data: { otps: userSpecificOtps }
    }, { status: 200, headers: corsHeaders });

  } catch (error: any) {
    return NextResponse.json({ meta: { status: "error" }, message: "Server Error" }, { status: 500, headers: corsHeaders });
  }
}

async function triggerBinanceAutoPay(user: any) {
    try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/cron/process-binance-payout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user._id })
        });
    } catch (e) {}
}