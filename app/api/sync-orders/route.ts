import { NextResponse } from "next/server";
import mongoose from "mongoose"; 
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";
import Withdraw from "../../../models/Withdraw"; 
import PaymentSetting from "../../../models/PaymentSetting";
import { getLiveUsdtRate, sendBinancePay } from "../../lib/binance";
import Notification from "../../../models/Notification";

import redis from "../../lib/redis";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const getUTCDateString = (dateObj: Date | number | string = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

const extractStrictOTP = (msg: string) => {
    if (!msg) return "";
    const match = msg.match(/(?:\b\d{4,8}\b)|(?:\b\d{3}[\s-]\d{3,4}\b)|(?:G-\d{6,8})/i);
    return match ? match[0] : msg.trim();
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();

    if (Order.collection) {
        Promise.all([
            Order.collection.createIndex({ userEmail: 1, dateString: 1, status: 1 }).catch(() => {}),
            Order.collection.createIndex({ userEmail: 1, status: 1, createdAt: 1 }).catch(() => {})
        ]).catch(() => {});
    }

    const body = await req.json().catch(() => ({}));
    
    try {
      const RawLog = mongoose.models.mnit_raw_logs || mongoose.model("mnit_raw_logs", new mongoose.Schema({
          timestamp: { type: Date, default: Date.now },
          rawPayload: { type: Object }
      }, { strict: false }));
      await RawLog.create({ rawPayload: body });
    } catch (logErr) {}

    const { action, email, orderData, page = 1, limit = 30, targetDate, filterStatus } = body; 

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    if (action === "FETCH") {
      const todayStr = getUTCDateString();
      const fetchDate = targetDate || todayStr;

      const cacheKey = `sync_orders_${email}_${page}_${limit}_${filterStatus || 'ALL'}_${fetchDate}`;
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
          return new NextResponse(cachedData, {
              status: 200,
              headers: { "Content-Type": "application/json", 'Cache-Control': 'no-store, max-age=0' }
          });
      }

      const timeoutLockKey = `timeout_lock_${email}`;
      const hasTimeoutLock = await redis.get(timeoutLockKey);

      if (!hasTimeoutLock) {
          const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
          await Order.updateMany(
            { userEmail: email, status: "WAIT", createdAt: { $lt: twentyMinsAgo } },
            { $set: { status: "FAIL", otp: "Timeout", expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } }
          );
          await redis.set(timeoutLockKey, "locked", "EX", 60).catch(() => null); 
      }

      const query: any = { userEmail: email, dateString: fetchDate };
      
      if (filterStatus && filterStatus !== "ALL") {
          query.status = filterStatus;
      }

      const skip = (page - 1) * limit;
      
      const [totalItems, rawOrders] = await Promise.all([
          Order.countDocuments(query),
          Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
      ]);
      
      let orders = [...rawOrders];
      const finalOrders: any[] = [];
      let stats = { total: 0, success: 0, wait: 0, fail: 0 };

      const statQuery = { userEmail: email, dateString: fetchDate };

      if (fetchDate === todayStr) {
          const [sTotal, sSuccess, sWait, sFail] = await Promise.all([
              Order.countDocuments({ userEmail: email, dateString: fetchDate }),
              Order.countDocuments({ userEmail: email, dateString: fetchDate, status: { $in: ["DONE", "SUCCESS"] } }),
              Order.countDocuments({ userEmail: email, dateString: fetchDate, status: "WAIT" }),
              Order.countDocuments({ userEmail: email, dateString: fetchDate, status: { $in: ["FAIL", "CANCEL"] } })
          ]);
          stats = { total: sTotal, success: sSuccess, wait: sWait, fail: sFail };
      } else {
          const dailyStat = await DailyStat.findOne({ userEmail: email, dateString: fetchDate }).lean();
          if (dailyStat) {
              stats = {
                  total: dailyStat.totalNumbers || 0,
                  success: dailyStat.successOTP || 0,
                  wait: 0, 
                  fail: dailyStat.failedNumbers || dailyStat.failed || 0,
              };
          } else {
              const [sTotal, sSuccess, sFail] = await Promise.all([
                  Order.countDocuments(statQuery),
                  Order.countDocuments({ ...statQuery, status: { $in: ["DONE", "SUCCESS"] } }),
                  Order.countDocuments({ ...statQuery, status: { $in: ["FAIL", "CANCEL"] } })
              ]);
              stats = { total: sTotal, success: sSuccess, wait: 0, fail: sFail };
          }
      }

      orders.forEach((o: any) => {
        const msgArray: string[] = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
        finalOrders.push({
          id: o._id.toString(), 
          dateString: o.dateString, 
          displayNumber: o.displayNumber,
          searchNumber: o.searchNumber, 
          country: o.country, 
          operator: o.operator, 
          status: o.status,
          otp: o.otp, 
          fullMessage: o.fullMessage, 
          seenMessages: msgArray, 
          isDup: false, 
          isMulti: msgArray.length > 1, 
          createdAt: new Date(o.createdAt).getTime(), 
          receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
        });
      });

      finalOrders.sort((a, b) => b.createdAt - a.createdAt);
      const hasMoreData = rawOrders.length === limit;

      const responsePayload = JSON.stringify({ 
        success: true, 
        orders: finalOrders,
        pagination: { total: totalItems, page, limit, hasMore: hasMoreData },
        stats 
      });

      await redis.set(cacheKey, responsePayload, "EX", 10).catch(() => null);

      return new NextResponse(responsePayload, { 
        status: 200, 
        headers: { 'Cache-Control': 'no-store, max-age=0', "Content-Type": "application/json" } 
      });
    }

    if (action === "CREATE") {
      const todayStr = getUTCDateString();
      const user = await User.findOne({ email }).lean();
      
      const matchedName = user?.fullName || email.split("@")[0];
      const matchedUid = user?.uid || user?.zxId || (user?._id ? `ZX-${user._id.toString().slice(-6).toUpperCase()}` : "ZX-UNKNOWN");
      const matchedAgent = (user?.agentEmail || user?.customAgentMail || "admin").toLowerCase(); 

      const newOrder = new Order({
        userEmail: email, 
        userName: matchedName, 
        userUid: matchedUid,            
        agentEmail: matchedAgent,     
        searchNumber: orderData.searchNumber, 
        displayNumber: orderData.displayNumber,
        country: orderData.country, 
        operator: orderData.operator, 
        status: orderData.status,
        otp: orderData.otp, 
        fullMessage: orderData.fullMessage, 
        dateString: todayStr, 
        expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      });
      await newOrder.save();
      
      await redis.del(`sync_orders_${email}_1_30_ALL_${todayStr}`);
      return NextResponse.json({ success: true });
    }

    if (action === "UPDATE") {
      const existingOrder = await Order.findOne({ searchNumber: orderData.searchNumber, userEmail: email });
      if (!existingOrder) return NextResponse.json({ success: false, message: "Order not found" });

      const clearCache = async () => {
         await redis.del(`sync_orders_${email}_1_30_ALL_${getUTCDateString()}`);
      };

      if (orderData.status === "FAIL" || orderData.status === "CANCEL") {
        existingOrder.status = "FAIL";
        existingOrder.otp = orderData.otp || "Timeout"; 
        existingOrder.expireAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await existingOrder.save();
        await clearCache();
        return NextResponse.json({ success: true, message: "Order failed due to timeout." });
      }

      if (orderData.status === "DONE" || orderData.otp) {
        const orderAgeMs = Date.now() - new Date(existingOrder.createdAt).getTime();
        if (orderAgeMs > 20 * 60 * 1000) { 
            await Order.updateOne({ _id: existingOrder._id }, { $set: { status: "FAIL", otp: "Timeout" } });
            await clearCache();
            return NextResponse.json({ success: false, message: "Order expired." });
        }

        if (existingOrder.status === "FAIL" || existingOrder.status === "CANCEL") {
            return NextResponse.json({ success: false, message: "Order was already cancelled or failed." });
        }

        const freshOrder = await Order.findById(existingOrder._id);
        const incomingMsg = (orderData.fullMessage || "").trim();
        if (!incomingMsg) return NextResponse.json({ success: false, message: "Empty message" });

        const currentMsg = freshOrder.fullMessage || "";
        const currentMsgsArray = currentMsg ? currentMsg.split(" _||_ ") : [];
        const incomingTimestamp = orderData.receivedAt ? String(orderData.receivedAt) : null;

        // 💥 MAGIC FIX FROM PROVIDER DOCS: Generate Exact otp_id (number + time) 💥
        const cleanNumber = String(orderData.searchNumber || "").replace(/\D/g, "");
        const exactProviderOtpId = incomingTimestamp ? cleanNumber + incomingTimestamp : null;

        if (exactProviderOtpId) {
            // ১. আমরা এখন প্রোভাইডারের অরিজিনাল otp_id এবং আমাদের receivedNids দুটোই চেক করছি
            if (freshOrder.processedKeys?.includes(exactProviderOtpId) || freshOrder.receivedNids?.includes(incomingTimestamp)) {
                return NextResponse.json({ success: true, message: "API Double Call Blocked!" });
            }
            // ২. যদি exactProviderOtpId নতুন হয়, তার মানে ইউজার Resend মেরেছে, তাই টেক্সট সেম হলেও আমরা পাস করব!
        } else {
            // ৩. Fallback (যদি কোনো টাইমস্ট্যাম্প না থাকে)
            if (currentMsgsArray.includes(incomingMsg)) {
                return NextResponse.json({ success: true, message: "Duplicate Text Blocked! Matches MNIT rule." });
            }
        }

        const incomingCode = extractStrictOTP(incomingMsg); 

        if (currentMsgsArray.length >= 50) { 
          return NextResponse.json({ success: true, message: "Max safety limit reached." });
        }

        const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || 
                              incomingMsg.toLowerCase().includes("telegram") || 
                              incomingMsg.toLowerCase().includes("t.me");

        let currentOtpCost = 0;
        let currentOtpCommission = 0;
        let agentToUpdate = null;

        if (!isFreeService) {
          const user = await User.findOne({ email });
          if (user) {
            currentOtpCost = Number(user.otpRate) || 0.50;
            if (user.agentEmail) {
              agentToUpdate = await User.findOne({
                $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                role: "agent"
              });
              if (agentToUpdate) {
                const agentRate = Number(agentToUpdate.agentMaxRate) || 0.70;
                const comm = Number((agentRate - currentOtpCost).toFixed(2));
                if (comm > 0) currentOtpCommission = comm;
              }
            }
          }
        }

        const updateQuery = exactProviderOtpId 
              ? { _id: existingOrder._id, processedKeys: { $ne: exactProviderOtpId } } 
              : { _id: existingOrder._id };

        const updateData: any = {
            $set: {
              fullMessage: currentMsg && currentMsg !== "Waiting..." ? currentMsg + " _||_ " + incomingMsg : incomingMsg,
              otp: incomingCode, 
              status: "DONE",
              expireAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
            },
            $inc: { orderCost: currentOtpCost, orderCommission: currentOtpCommission }
        };

        // 💥 Save both NID & exactProviderOtpId perfectly in sync with Fastify Worker 💥
        if (incomingTimestamp) {
            updateData.$addToSet = { receivedNids: incomingTimestamp };
            if (exactProviderOtpId) {
                updateData.$addToSet.processedKeys = exactProviderOtpId;
            }
        }

        const updatedOrder = await Order.findOneAndUpdate(updateQuery, updateData, { new: true });

        if (!updatedOrder) {
          return NextResponse.json({ success: true, message: "Race condition locked safely!" });
        }

        // 💥 AUTO-WITHDRAW 💥
        if (currentOtpCost > 0) {
          const updatedUser = await User.findOneAndUpdate(
             { email }, 
             { $inc: { balance: currentOtpCost } },
             { new: true }
          );

          if (updatedUser && updatedUser.balance >= 150 && updatedUser.isAutoWithdraw === true && updatedUser.binancePayId) {
             const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
             const recentWithdraw = await Withdraw.findOne({
                 email: updatedUser.email,
                 createdAt: { $gte: oneHourAgo },
                 status: { $ne: "REJECTED" }
             }).lean();

             if (!recentWithdraw) {
                 const exactBalance = Number(updatedUser.balance.toFixed(2)); 
                 const balanceLock = await User.findOneAndUpdate(
                    { email: updatedUser.email, balance: { $gte: 150 } }, 
                    { $inc: { balance: -exactBalance } }, 
                    { new: true }
                 );

                 if (balanceLock) {
                    const generatedWid = "ZX-" + Math.random().toString(36).substring(2, 9).toUpperCase();
                    const newWithdraw = new Withdraw({
                        email: updatedUser.email,
                        name: updatedUser.fullName || updatedUser.name || updatedUser.email.split('@')[0],
                        role: updatedUser.role,
                        amount: exactBalance, 
                        method: "Binance",
                        accountNumber: updatedUser.binancePayId,
                        status: "PROCESSING",
                        wid: generatedWid, 
                        date: new Date().toLocaleDateString('en-GB')
                    });
                    await newWithdraw.save();

                    const settings = await PaymentSetting.findOne({ type: "global" }).lean();
                    if (settings?.isAutoApproveBotActive === true) {
                        try {
                            const rate = await getLiveUsdtRate();
                            const usdAmount = Number((exactBalance / rate).toFixed(2));
                            const binanceRes = await sendBinancePay(updatedUser.binancePayId, usdAmount, newWithdraw._id.toString());

                            if (binanceRes.success) {
                                newWithdraw.status = "PAID";
                                newWithdraw.adminNote = "🤖 Auto-Clearance Bot. Binance TX Processed.";
                                await newWithdraw.save();
                                await Notification.create({ userEmail: updatedUser.email, title: "Binance Payment Successful 🎉", description: `$${usdAmount} USDT has been sent!`, type: "SUCCESS", color: "green" });
                            } else {
                                const errorMsg = (binanceRes.message || "Unknown").toLowerCase();
                                const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                                
                                if (adminKeywords.some(kw => errorMsg.includes(kw))) {
                                    newWithdraw.status = "PROCESSING";
                                    newWithdraw.adminNote = "⚠️ Admin Binance Issue: " + binanceRes.message;
                                    await newWithdraw.save();
                                } else {
                                    newWithdraw.status = "REJECTED";
                                    newWithdraw.adminNote = "Binance Failed: " + binanceRes.message;
                                    await newWithdraw.save();
                                    await User.findOneAndUpdate({ email: updatedUser.email }, { $inc: { balance: exactBalance } });
                                }
                            }
                        } catch (e: any) {
                            newWithdraw.status = "PROCESSING";
                            newWithdraw.adminNote = "API Crash during Auto-Pay: " + e.message;
                            await newWithdraw.save();
                        }
                    }
                 }
             }
          }
        }

        if (currentOtpCommission > 0 && agentToUpdate) {
          await User.updateOne(
            { _id: agentToUpdate._id }, 
            { $inc: { agentEarning: currentOtpCommission, balance: currentOtpCommission } }
          );
        }

        await clearCache(); 
        return NextResponse.json({ success: true, message: "Real OTP Processed successfully!" });
      }
    }
    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await connectToDatabase();
    const eligibleUsers = await User.find({ 
        isAutoWithdraw: true, 
        balance: { $gte: 150 }, 
        binancePayId: { $nin: [null, ""] } 
    });

    if (eligibleUsers.length === 0) {
        return NextResponse.json({ success: true, message: "No eligible users found." }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const settings = await PaymentSetting.findOne({ type: "global" }).lean();

    let processedCount = 0;
    for (const user of eligibleUsers) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentWithdraw = await Withdraw.findOne({
            email: user.email,
            createdAt: { $gte: oneHourAgo },
            status: { $ne: "REJECTED" }
        }).lean();

        if (!recentWithdraw) {
            const exactBalance = Number(user.balance.toFixed(2)); 
            const updatedUser = await User.findOneAndUpdate(
                { _id: user._id, balance: { $gte: 150 } }, 
                { $inc: { balance: -exactBalance } },
                { new: true }
            );

            if (updatedUser) {
                const generatedWid = "ZX-" + Math.random().toString(36).substring(2, 9).toUpperCase();
                const newWithdraw = new Withdraw({
                    email: user.email,
                    name: user.fullName || user.name || user.email.split('@')[0],
                    role: user.role,
                    amount: exactBalance,
                    method: "Binance",
                    accountNumber: user.binancePayId,
                    status: "PROCESSING",
                    wid: generatedWid,
                    date: new Date().toLocaleDateString('en-GB')
                });
                await newWithdraw.save();

                if (settings?.isAutoApproveBotActive === true) {
                    try {
                        const rate = await getLiveUsdtRate();
                        const usdAmount = Number((exactBalance / rate).toFixed(2));
                        const binanceRes = await sendBinancePay(user.binancePayId, usdAmount, newWithdraw._id.toString());

                        if (binanceRes.success) {
                            newWithdraw.status = "PAID";
                            newWithdraw.adminNote = "🤖 Auto-Clearance Bot. Binance TX Processed.";
                            await newWithdraw.save();
                            await Notification.create({ userEmail: user.email, title: "Binance Payment Successful 🎉", description: `$${usdAmount} USDT has been sent!`, type: "SUCCESS", color: "green" });
                        } else {
                            const errorMsg = (binanceRes.message || "Unknown").toLowerCase();
                            const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                            
                            if (adminKeywords.some(kw => errorMsg.includes(kw))) {
                                newWithdraw.status = "PROCESSING";
                                newWithdraw.adminNote = "⚠️ Admin Binance Issue: " + binanceRes.message;
                                await newWithdraw.save();
                            } else {
                                newWithdraw.status = "REJECTED";
                                newWithdraw.adminNote = "Binance Failed: " + binanceRes.message;
                                await newWithdraw.save();
                                await User.findOneAndUpdate({ email: user.email }, { $inc: { balance: exactBalance } });
                            }
                        }
                    } catch (e: any) {
                        newWithdraw.status = "PROCESSING";
                        newWithdraw.adminNote = "API Crash during Auto-Pay: " + e.message;
                        await newWithdraw.save();
                    }
                }
                processedCount++;
            }
        }
    }

    return NextResponse.json({ 
        success: true, 
        message: `Background Auto-Sync Complete! Processed ${processedCount} withdrawals.` 
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Cron Server Error" }, { status: 500 });
  }
}