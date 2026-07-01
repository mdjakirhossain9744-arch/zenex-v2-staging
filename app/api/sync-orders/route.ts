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

export async function POST(req: Request) {
  try {
    await connectToDatabase();

    if (Order.collection) {
        Promise.all([
            Order.collection.createIndex({ userEmail: 1, dateString: 1, status: 1 }).catch(() => {}),
            Order.collection.createIndex({ userEmail: 1, status: 1, createdAt: -1 }).catch(() => {})
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

    // ==========================================
    // FETCH ACTION
    // ==========================================
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

      // Exact Multi-OTP Stats Calculation
      if (fetchDate === todayStr) {
          const [sTotal, sWait, sFail] = await Promise.all([
              Order.countDocuments({ userEmail: email, dateString: fetchDate }),
              Order.countDocuments({ userEmail: email, dateString: fetchDate, status: "WAIT" }),
              Order.countDocuments({ userEmail: email, dateString: fetchDate, status: { $in: ["FAIL", "CANCEL"] } })
          ]);
          
          const successDocs = await Order.find(
              { userEmail: email, dateString: fetchDate, status: { $in: ["DONE", "SUCCESS"] } },
              { processedKeys: 1, fullMessage: 1 }
          ).lean();

          let exactSuccessOTPs = 0;
          successDocs.forEach((doc: any) => {
              if (Array.isArray(doc.processedKeys) && doc.processedKeys.length > 0) {
                  exactSuccessOTPs += doc.processedKeys.length;
              } else if (typeof doc.fullMessage === "string" && doc.fullMessage.trim() !== "") {
                  exactSuccessOTPs += doc.fullMessage.split(" _||_ ").length;
              } else {
                  exactSuccessOTPs += 1;
              }
          });

          stats = { total: sTotal, success: exactSuccessOTPs, wait: sWait, fail: sFail };
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
              const [sTotal, sFail] = await Promise.all([
                  Order.countDocuments(statQuery),
                  Order.countDocuments({ ...statQuery, status: { $in: ["FAIL", "CANCEL"] } })
              ]);

              const historySuccessDocs = await Order.find(
                  { ...statQuery, status: { $in: ["DONE", "SUCCESS"] } },
                  { processedKeys: 1, fullMessage: 1 }
              ).lean();

              let sSuccessHistory = 0;
              historySuccessDocs.forEach((doc: any) => {
                  if (Array.isArray(doc.processedKeys) && doc.processedKeys.length > 0) {
                      sSuccessHistory += doc.processedKeys.length;
                  } else if (typeof doc.fullMessage === "string" && doc.fullMessage.trim() !== "") {
                      sSuccessHistory += doc.fullMessage.split(" _||_ ").length;
                  } else {
                      sSuccessHistory += 1;
                  }
              });

              stats = { total: sTotal, success: sSuccessHistory, wait: 0, fail: sFail };
          }
      }

      orders.forEach((o: any) => {
        const msgArray: string[] = typeof o.fullMessage === "string" && o.fullMessage.trim() !== "" ? o.fullMessage.split(" _||_ ") : [];
        
        let exactOtpCount = 0;
        if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) {
            exactOtpCount = o.processedKeys.length;
        } else if (msgArray.length > 0) {
            exactOtpCount = msgArray.length;
        } else if (o.status === "DONE" || o.status === "SUCCESS") {
            exactOtpCount = 1;
        }

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
          exactSuccessCount: exactOtpCount, 
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

      // 🔥 MISSION 2 FIX: Real-Time Cache (2 Seconds instead of 10s)
      await redis.set(cacheKey, responsePayload, "EX", 3).catch(() => null);

      return new NextResponse(responsePayload, { 
        status: 200, 
        headers: { 'Cache-Control': 'no-store, max-age=0', "Content-Type": "application/json" } 
      });
    }

    // ==========================================
    // CREATE ACTION
    // ==========================================
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

    // ==========================================
    // UPDATE ACTION (💥 ZERO-TRUST SECURITY SHIELD 💥)
    // ==========================================
    if (action === "UPDATE") {
      // 1. Remove status lock from query to check actual current state
      const existingOrder = await Order.findOne({ 
          searchNumber: orderData.searchNumber, 
          userEmail: email
      }).sort({ createdAt: -1 });

      if (!existingOrder) return NextResponse.json({ success: false, message: "Order not found." });

      // 2. 🛡️ THE BOSS SHIELD: If it's already DONE, reject any Cancel/Timeout attempts from Frontend
      if (existingOrder.status === "DONE" || existingOrder.status === "SUCCESS") {
          return NextResponse.json({ 
              success: true, 
              message: "Secure Mode: Order already completed. Cannot overwrite OTP." 
          });
      }

      const clearCache = async () => {
         await redis.del(`sync_orders_${email}_1_30_ALL_${getUTCDateString()}`);
      };

      // 3. Only allow FAIL/CANCEL if the order is genuinely still WAITING
      if (orderData.status === "FAIL" || orderData.status === "CANCEL") {
        if (existingOrder.status === "WAIT" || existingOrder.status === "PENDING") {
            existingOrder.status = "FAIL";
            existingOrder.otp = orderData.otp || "Timeout"; 
            existingOrder.expireAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
            await existingOrder.save();
            await clearCache();
            return NextResponse.json({ success: true, message: "Order failed due to timeout." });
        }
      }

      if (orderData.status === "DONE" || orderData.otp) {
          return NextResponse.json({ 
              success: true, 
              message: "Secure Mode: Wait for Server (Engine-2) to process real OTP and Payments." 
          });
      }
    }
    
    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}

// ==========================================
// BACKGROUND AUTO-SYNC CRON JOB API
// ==========================================
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