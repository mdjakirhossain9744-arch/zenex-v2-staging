import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Withdraw from "../../../models/Withdraw"; 
import User from "../../../models/User"; 
import PaymentSetting from "../../../models/PaymentSetting"; 
import Notification from "../../../models/Notification";
import { getLiveUsdtRate, sendBinancePay, validateSolanaAddress } from "../../lib/binance"; 
import { adminMessaging } from "../../lib/firebase-admin"; 

export const dynamic = "force-dynamic";

// 💥 ELITE IN-MEMORY CACHE ENGINE & THREAD LOCK (STAMPEDE PROTECTION) 💥
let withdrawStatsCache: any = null;
let withdrawStatsCacheTime = 0;
let isGeneratingWithdrawStats = false; // Prevents DB Lock when multiple admins reload at exact same ms
const STATS_TTL = 3 * 60 * 1000; // 3 Minutes Cache

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json().catch(() => ({}));
    const { action, email, name, role, amount, method, accountNumber, withdrawPin, withdrawId, newStatus, selectedIds, actionType } = body; 

    // 💥 1. CREATE CUSTOM WITHDRAW 💥
    if (action === "CREATE") {
      const safeAmount = parseFloat(Number(amount).toFixed(4));
      
      // 💥 BOSS UPGRADE: MINIMUM LIMITS 💥
      let minRequired = 1.00; // Default for bKash, Nagad, Rocket
      if (method === "Binance") minRequired = 0.50; // Binance Manual Limit

      if (!safeAmount || isNaN(safeAmount) || safeAmount < minRequired) {
        return NextResponse.json({ success: false, message: `Invalid amount. Minimum for ${method} is $ ${minRequired.toFixed(4)}.` }, { status: 400 });
      }
      if (!withdrawPin) return NextResponse.json({ success: false, message: "Security PIN is required!" }, { status: 400 });

      if (method === "Binance") {
          const addressCheck = validateSolanaAddress(accountNumber);
          if (!addressCheck.isValid) {
              return NextResponse.json({ success: false, message: addressCheck.message }, { status: 400 });
          }
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentWithdraw = await Withdraw.findOne({ 
          email: email, 
          createdAt: { $gte: oneHourAgo }, 
          status: { $ne: "REJECTED" } 
      }).lean();

      if (recentWithdraw) {
          return NextResponse.json({ 
              success: false, 
              message: "⏳ Please wait 1 hour between withdrawals. You can withdraw up to 24 times a day!" 
          }, { status: 429 });
      }

      const user = await User.findOne({ email });
      if (!user) return NextResponse.json({ success: false, message: "User not found!" }, { status: 404 });
      if ((user.withdrawPin || "1234") !== withdrawPin.trim()) return NextResponse.json({ success: false, message: "🔴 Invalid Security PIN!" }, { status: 403 });

      const settings = await PaymentSetting.findOne({ type: "global" });
      if (settings && (settings.isWithdrawOpen === false || (settings.methods && settings.methods[method as keyof typeof settings.methods] === false))) {
         return NextResponse.json({ success: false, message: "Gateway is closed by Admin!" }, { status: 400 });
      }

      const updatedUser = await User.findOneAndUpdate(
          { email: email, balance: { $gte: safeAmount } }, 
          { $inc: { balance: -safeAmount } }, 
          { new: true }
      );
      if (!updatedUser) return NextResponse.json({ success: false, message: "Insufficient Balance!" }, { status: 400 });

      const generatedWid = "ZX-" + Math.random().toString(36).substring(2, 9).toUpperCase();
      let finalStatus = "PENDING";
      let finalAdminNote = "Processing request...";
      let autoPaySuccess = false;

      // 🚀 🤖 THE ADMIN ROBOT LOGIC (BINANCE ONLY) 🤖
      if (method === "Binance" && settings?.isAutoApproveBotActive === true) {
          try {
              // 💥 BOSS UPGRADE: 110 TK P2P CONVERSION MATH 💥
              const rate = await getLiveUsdtRate(); // e.g., 128
              const systemBdtValue = safeAmount * 110; // 1 System USD = 110 BDT
              const actualBinanceUsd = Number((systemBdtValue / rate).toFixed(4)); 
              
              const binanceRes = await sendBinancePay(accountNumber, actualBinanceUsd, generatedWid);

              if (binanceRes.success) {
                  finalStatus = "PAID";
                  // 💥 BOSS SECRECY FIX: Scrubbed TrxID to hide Off-Chain Payout Strategy 💥
                  finalAdminNote = `🤖 Auto-Paid. $${actualBinanceUsd} USDT sent successfully.`;
                  autoPaySuccess = true;
                  
                  await Notification.create({ userEmail: email, title: "Binance Payment Successful 🎉", description: `$${actualBinanceUsd} USDT has been sent to your wallet!`, type: "SUCCESS", color: "green" });
              } else {
                  const errorMsg = (binanceRes.message || "Unknown").toLowerCase();
                  const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                  const isAdminFault = adminKeywords.some(kw => errorMsg.includes(kw));

                  if (isAdminFault) {
                      finalStatus = "PROCESSING"; 
                      finalAdminNote = "⚠️ Admin Binance Issue: " + binanceRes.message;
                      await PaymentSetting.findOneAndUpdate({ type: "global" }, { $set: { isAutoApproveBotActive: false } });
                  } else {
                      // 💥 BOSS FIX: Auto-Withdraw OFF on Fail & Refund 💥
                      await User.findOneAndUpdate({ email: email }, { 
                          $inc: { balance: safeAmount },
                          $set: { isAutoWithdraw: false }
                      });
                      await Notification.create({ 
                          userEmail: email, title: "Payment Rejected 🔴", 
                          description: `Payout rejected: ${binanceRes.message}. Balance refunded & Auto-Withdraw disabled.`, 
                          type: "ERROR", color: "red" 
                      });
                      return NextResponse.json({ success: false, message: `Binance Error: ${binanceRes.message}. Refunded & Auto-Withdraw disabled.` });
                  }
              }
          } catch (apiErr: any) {
              finalStatus = "PROCESSING";
              finalAdminNote = "API Crash during Auto-Pay: " + apiErr.message;
              await PaymentSetting.findOneAndUpdate({ type: "global" }, { $set: { isAutoApproveBotActive: false } });
          }
      }

      const newWithdraw = new Withdraw({ 
          email, name, role, amount: safeAmount, method, accountNumber, 
          date: new Date().toLocaleDateString('en-GB'),
          wid: generatedWid,
          status: finalStatus,
          adminNote: finalAdminNote
      });
      await newWithdraw.save();

      if (adminMessaging) {
          if (autoPaySuccess) {
             User.findOne({ email: email, fcmToken: { $exists: true, $ne: "" } }).then(u => {
                 if (u && u.fcmToken) adminMessaging.send({ token: u.fcmToken, notification: { title: "🎉 Payment Received!", body: `Your withdraw of $${safeAmount} has been auto-paid!` } }).catch(()=>{});
             }).catch(()=>{});
          } else {
             User.find({ role: "admin", fcmToken: { $exists: true, $ne: "" } }).then(admins => {
                 admins.forEach(adminUser => {
                     adminMessaging.send({ token: adminUser.fcmToken, notification: { title: "💰 New Withdraw Request!", body: `${name} requested $${safeAmount} via ${method}.` } }).catch(()=>{});
                 });
             }).catch(()=>{});
          }
      }

      const successMsg = autoPaySuccess ? "Withdraw successful! USD has been sent to your Binance wallet." : "Withdraw request submitted successfully!";
      return NextResponse.json({ success: true, message: successMsg });
    }

    // 💥 2. BULK ACTION 💥
    if (action === "BULK_ACTION") {
      const withdraws = await Withdraw.find({ _id: { $in: selectedIds } });
      let successCount = 0; let failCount = 0;

      for (const request of withdraws) {
        if (actionType === "PAID" && (request.status === "PROCESSING" || request.status === "PENDING")) {
          const lockedReq = await Withdraw.findOneAndUpdate({ _id: request._id, status: { $in: ["PROCESSING", "PENDING"] } }, { $set: { status: "PAYING_LOCK" } }, { new: true });
          if (!lockedReq) continue;

          let paymentSuccessful = false;
          let paymentAmount: string | number = request.amount;

          if (request.method === "Binance") {
            try {
              // 💥 BOSS UPGRADE: 110 TK P2P CONVERSION MATH 💥
              const rate = await getLiveUsdtRate();
              const systemBdtValue = request.amount * 110; 
              const actualBinanceUsd = Number((systemBdtValue / rate).toFixed(4));
              
              const binanceRes = await sendBinancePay(request.accountNumber, actualBinanceUsd, request._id.toString());
              
              if (binanceRes.success) {
                lockedReq.status = "PAID";
                // 💥 BOSS SECRECY FIX: Scrubbed TrxID 💥
                lockedReq.adminNote = `Auto Paid. $${actualBinanceUsd} USDT sent successfully.`;
                await lockedReq.save();
                await Notification.create({ userEmail: request.email, title: "Binance Payment Successful 🎉", description: `$${actualBinanceUsd} USDT has been sent!`, type: "SUCCESS", color: "green" });
                paymentSuccessful = true; paymentAmount = `$${actualBinanceUsd} USDT`; successCount++;
              } else {
                const errorMsg = (binanceRes.message || "Unknown").toLowerCase();
                const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                
                if (adminKeywords.some(kw => errorMsg.includes(kw))) {
                  lockedReq.status = "PROCESSING"; lockedReq.adminNote = "Admin Issue: " + binanceRes.message; await lockedReq.save(); failCount++;
                } else {
                  lockedReq.status = "REJECTED"; lockedReq.adminNote = "Binance Failed: " + binanceRes.message; await lockedReq.save();
                  // 💥 BOSS FIX: Auto-Withdraw OFF on Fail & Refund 💥
                  await User.findOneAndUpdate({ email: request.email }, { 
                      $inc: { balance: request.amount },
                      $set: { isAutoWithdraw: false }
                  });
                  await Notification.create({ userEmail: request.email, title: "Payment Rejected 🔴", description: `Payout rejected: ${binanceRes.message}. Refunded & Auto-Withdraw disabled.`, type: "ERROR", color: "red" });
                  failCount++;
                }
              }
            } catch (e: any) {
              lockedReq.status = "PROCESSING"; lockedReq.adminNote = "API Crash: " + e.message; await lockedReq.save(); failCount++;
            }
          } else {
            lockedReq.status = "PAID"; lockedReq.adminNote = "Manual Payment Completed."; await lockedReq.save();
            await Notification.create({ userEmail: request.email, title: "Payment Successful 🎉", description: `$ ${request.amount} has been paid!`, type: "SUCCESS", color: "green" });
            paymentSuccessful = true; paymentAmount = `$${request.amount}`; successCount++;
          }

          if (paymentSuccessful && adminMessaging) {
              User.findOne({ email: request.email, fcmToken: { $exists: true, $ne: "" } }).then(u => {
                  if (u && u.fcmToken) adminMessaging.send({ token: u.fcmToken, notification: { title: "🎉 Payment Received!", body: `Your withdraw of ${paymentAmount} has been paid via ${request.method}.` } }).catch(()=>{});
              }).catch(()=>{});
          }
        } 
        else if (actionType === "PROCESS" && request.status === "PENDING") {
          request.status = "PROCESSING"; request.adminNote = "Request is being verified..."; await request.save(); successCount++;
        }
      }
      withdrawStatsCacheTime = 0;
      return NextResponse.json({ success: true, message: `Bulk Executed: ${successCount} Success, ${failCount} Failed/Admin Error.` });
    }

    // 💥 3. UPDATE SINGLE STATUS 💥
    if (action === "UPDATE_STATUS") {
      if (newStatus === "PAID") {
         const request = await Withdraw.findOneAndUpdate({ _id: withdrawId, status: { $in: ["PROCESSING", "PENDING"] } }, { $set: { status: "PAYING_LOCK" } }, { new: true });
         if (!request) return NextResponse.json({ success: false, message: "Request already processed or locked!" });

         let paymentAmountMsg = `$${request.amount}`;

         if (request.method === "Binance") {
             try {
                 // 💥 BOSS UPGRADE: 110 TK P2P CONVERSION MATH 💥
                 const rate = await getLiveUsdtRate();
                 const systemBdtValue = request.amount * 110; 
                 const actualBinanceUsd = Number((systemBdtValue / rate).toFixed(4));
                 
                 const binanceRes = await sendBinancePay(request.accountNumber, actualBinanceUsd, request._id.toString());

                 if (binanceRes.success) {
                     request.status = "PAID"; 
                     // 💥 BOSS SECRECY FIX: Scrubbed TrxID 💥
                     request.adminNote = `Auto Paid. $${actualBinanceUsd} USDT sent successfully.`; 
                     await request.save();
                     await Notification.create({ userEmail: request.email, title: "Binance Payment Successful 🎉", description: `$${actualBinanceUsd} USDT has been sent!`, type: "SUCCESS", color: "green" });
                     paymentAmountMsg = `$${actualBinanceUsd} USDT`;
                 } else {
                     const errorMsg = (binanceRes.message || "Unknown").toLowerCase();
                     const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                     
                     if (adminKeywords.some(kw => errorMsg.includes(kw))) {
                         request.status = "PROCESSING"; request.adminNote = "Admin Issue: " + binanceRes.message; await request.save();
                         return NextResponse.json({ success: false, message: `⚠️ Admin Binance Issue: ${binanceRes.message}` });
                     } else {
                         request.status = "REJECTED"; request.adminNote = "Binance Failed: " + binanceRes.message; await request.save();
                         // 💥 BOSS FIX: Auto-Withdraw OFF on Fail & Refund 💥
                         await User.findOneAndUpdate({ email: request.email }, { 
                             $inc: { balance: request.amount },
                             $set: { isAutoWithdraw: false }
                         });
                         await Notification.create({ userEmail: request.email, title: "Payment Rejected 🔴", description: `Payout rejected. Refunded & Auto-Withdraw disabled.`, type: "ERROR", color: "red" });
                         return NextResponse.json({ success: false, message: `Binance Failed: ${binanceRes.message}. Refunded & Auto-Withdraw disabled.` });
                     }
                 }
             } catch (apiErr: any) {
                 request.status = "PROCESSING"; request.adminNote = "API Crash: " + apiErr.message; await request.save();
                 return NextResponse.json({ success: false, message: `API Crash: ${apiErr.message}` });
             }
         } else {
             request.status = "PAID"; request.adminNote = "Manual Payment Completed."; await request.save();
             await Notification.create({ userEmail: request.email, title: "Payment Successful 🎉", description: `$ ${request.amount} has been paid!`, type: "SUCCESS", color: "green" });
         }

         if (adminMessaging) {
             User.findOne({ email: request.email, fcmToken: { $exists: true, $ne: "" } }).then(u => {
                 if (u && u.fcmToken) adminMessaging.send({ token: u.fcmToken, notification: { title: "🎉 Payment Received!", body: `Your withdraw of ${paymentAmountMsg} has been paid via ${request.method}.` } }).catch(()=>{});
             }).catch(()=>{});
         }
         withdrawStatsCacheTime = 0; 
         return NextResponse.json({ success: true, message: "Status updated to PAID" });
      }

      const request = await Withdraw.findById(withdrawId);
      if (!request) return NextResponse.json({ success: false, message: "Request not found!" });

      if (newStatus === "PROCESSING" && request.status !== "PROCESSING") {
         request.adminNote = "Request is being verified...";
         const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
         if (googleSheetUrl && request.method !== "Binance") { 
             fetch(googleSheetUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: request.date, name: request.name, email: request.email, amount: request.amount, method: request.method, accountNumber: request.accountNumber, status: "PROCESSING" }) }).catch(()=>{}); 
         }
      }

      if (newStatus === "REJECTED" && request.status !== "REJECTED") {
         request.adminNote = "Rejected manually by Admin. Refunded.";
         // 💥 BOSS FIX: Manual Reject disables auto withdraw 💥
         await User.findOneAndUpdate({ email: request.email }, { 
             $inc: { balance: request.amount },
             $set: { isAutoWithdraw: false }
         });
         await Notification.create({ userEmail: request.email, title: "Withdrawal Rejected 🔴", description: `Admin rejected your payout of $ ${request.amount}. Balance refunded.`, type: "ERROR", color: "red" });
      } 
      else if (request.status === "REJECTED" && newStatus !== "REJECTED") {
         request.adminNote = "Action Reversed by Admin.";
         const userCheck = await User.findOne({ email: request.email });
         if (!userCheck || userCheck.balance < request.amount) return NextResponse.json({ success: false, message: "Insufficient balance to undo!" }, { status: 400 });
         await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: -request.amount } });
      }

      request.status = newStatus;
      await request.save();
      withdrawStatsCacheTime = 0; 
      return NextResponse.json({ success: true, message: `Status updated to ${newStatus}` });
    }

    // 💥 4. FETCH LOGIC 💥
    if (action === "FETCH") {
      if (role === "admin") {
         const { tab = "MANUAL_PENDING", timeFilter = "ALL", searchQuery = "", page = 1, limit = 50 } = body;
         let query: any = {};
         
         if (tab === "MANUAL_PENDING") { query.status = "PENDING"; query.method = { $ne: "Binance" }; }
         if (tab === "MANUAL_PROCESSING") { query.status = "PROCESSING"; query.method = { $ne: "Binance" }; }
         if (tab === "BINANCE_AUTO") { query.status = { $in: ["PENDING", "PROCESSING"] }; query.method = "Binance"; }
         if (tab === "HISTORY") query.status = { $in: ["PAID", "REJECTED"] };

         if (searchQuery) { 
             query.$or = [
                 { wid: { $regex: searchQuery, $options: "i" } },
                 { name: { $regex: searchQuery, $options: "i" } }, 
                 { email: { $regex: searchQuery, $options: "i" } }, 
                 { accountNumber: { $regex: searchQuery, $options: "i" } }
             ]; 
         }

         if (timeFilter !== "ALL" && tab === "HISTORY") {
            const now = new Date();
            let days = 7;
            if (timeFilter === "15DAYS") days = 15;
            if (timeFilter === "30DAYS") days = 30;
            query.createdAt = { $gte: new Date(now.setDate(now.getDate() - days)) };
         }

         const skip = (page - 1) * limit;

         let currentStats;
         if (withdrawStatsCache && (Date.now() - withdrawStatsCacheTime < STATS_TTL)) {
             currentStats = withdrawStatsCache;
         } else if (isGeneratingWithdrawStats && withdrawStatsCache) {
             currentStats = withdrawStatsCache;
         } else {
             isGeneratingWithdrawStats = true;
             try {
                 const [pendingAgg, paidAgg, allAgg, totalCount, userBalAgg] = await Promise.all([
                     Withdraw.aggregate([ { $match: { status: { $in: ["PENDING", "PROCESSING"] } } }, { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } } ]),
                     Withdraw.aggregate([ { $match: { status: "PAID" } }, { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } } ]),
                     Withdraw.aggregate([ { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } } ]),
                     Withdraw.countDocuments(),
                     User.aggregate([ { $group: { _id: null, total: { $sum: { $convert: { input: "$balance", to: "double", onError: 0, onNull: 0 } } } } } ])
                 ]);
                 currentStats = { 
                     totalRequests: totalCount, 
                     pendingAmount: Number((pendingAgg[0]?.total || 0).toFixed(4)), 
                     paidAmount: Number((paidAgg[0]?.total || 0).toFixed(4)), 
                     totalAmount: Number((allAgg[0]?.total || 0).toFixed(4)),
                     systemLiability: Number((userBalAgg[0]?.total || 0).toFixed(4))
                 };
                 withdrawStatsCache = currentStats;
                 withdrawStatsCacheTime = Date.now();
             } finally {
                 isGeneratingWithdrawStats = false;
             }
         }

         // 💥 BOSS FIX: TypeScript Error Solved using Record<string, 1 | -1> 💥
         const sortLogic: Record<string, 1 | -1> = tab === "HISTORY" ? { updatedAt: -1 } : { createdAt: -1 };

         const [totalItems, rawRequests] = await Promise.all([
             Withdraw.countDocuments(query),
             Withdraw.find(query).sort(sortLogic).skip(skip).limit(limit).lean()
         ]);
         
         const requests = rawRequests.map((r: any) => ({ ...r, amount: Number((r.amount || 0).toFixed(4)) }));

         return NextResponse.json({ 
            success: true, data: requests, 
            pagination: { total: totalItems, page, limit, totalPages: Math.ceil(totalItems / limit) || 1 },
            stats: currentStats
         });
      } else {
         let rawRequests = await Withdraw.find({ email }).sort({ createdAt: -1 }).limit(100).lean();
         const requests = rawRequests.map((r: any) => ({ ...r, amount: Number((r.amount || 0).toFixed(4)) }));
         return NextResponse.json({ success: true, data: requests });
      }
    }
    return NextResponse.json({ success: false, message: "Invalid Request Action" }, { status: 400 });
  } catch (error: any) {
    isGeneratingWithdrawStats = false; 
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}