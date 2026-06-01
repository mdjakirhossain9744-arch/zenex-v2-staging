import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Withdraw from "../../../models/Withdraw"; 
import User from "../../../models/User"; 
import PaymentSetting from "../../../models/PaymentSetting"; 
import Notification from "../../../models/Notification";
import { getLiveUsdtRate, sendBinancePay } from "../../lib/binance"; 

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json().catch(() => ({}));
    const { action, email, name, role, amount, method, accountNumber, withdrawPin, withdrawId, newStatus, selectedIds, actionType } = body; 

    // 💥 1. CREATE CUSTOM WITHDRAW 💥
    if (action === "CREATE") {
      const safeAmount = Number(amount);
      if (!safeAmount || isNaN(safeAmount) || safeAmount < 100) return NextResponse.json({ success: false, message: "Invalid amount. Minimum is ৳ 100." }, { status: 400 });
      if (!withdrawPin) return NextResponse.json({ success: false, message: "Security PIN is required!" }, { status: 400 });

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

      const newWithdraw = new Withdraw({ 
          email, 
          name, 
          role, 
          amount: safeAmount, 
          method, 
          accountNumber, 
          date: new Date().toLocaleDateString('en-GB'),
          wid: generatedWid,
          adminNote: "Processing request..."
      });
      await newWithdraw.save();
      return NextResponse.json({ success: true, message: "Withdraw request submitted successfully!" });
    }

    // 💥 2. BULK ACTION 💥
    if (action === "BULK_ACTION") {
      const withdraws = await Withdraw.find({ _id: { $in: selectedIds } });
      let successCount = 0;
      let failCount = 0;

      for (const request of withdraws) {
        if (actionType === "PAID" && (request.status === "PROCESSING" || request.status === "PENDING")) {
          const lockedReq = await Withdraw.findOneAndUpdate({ _id: request._id, status: { $in: ["PROCESSING", "PENDING"] } }, { $set: { status: "PAYING_LOCK" } }, { new: true });
          if (!lockedReq) continue;

          if (request.method === "Binance") {
            try {
              const rate = await getLiveUsdtRate();
              const usdAmount = Number((request.amount / rate).toFixed(2));
              const binanceRes = await sendBinancePay(request.accountNumber, usdAmount, request._id.toString());
              
              if (binanceRes.success) {
                lockedReq.status = "PAID";
                lockedReq.adminNote = "Auto Paid. Binance TX Processed.";
                await lockedReq.save();
                await Notification.create({ userEmail: request.email, title: "Binance Payment Successful 🎉", description: `$${usdAmount} USDT has been sent!`, type: "SUCCESS", color: "green" });
                successCount++;
              } else {
                const errorMsg = (binanceRes.message || "Unknown Binance Error").toLowerCase();
                const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                const isAdminFault = adminKeywords.some(kw => errorMsg.includes(kw));

                if (isAdminFault) {
                  lockedReq.status = "PROCESSING"; 
                  lockedReq.adminNote = "Admin Issue: " + binanceRes.message;
                  await lockedReq.save();
                  failCount++;
                } else {
                  lockedReq.status = "REJECTED"; 
                  lockedReq.adminNote = "Binance Failed: " + binanceRes.message;
                  await lockedReq.save();
                  await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: request.amount }, $set: { isAutoWithdraw: false } });
                  
                  // 💥 FIXED: Detailed Notification Title & Description 💥
                  await Notification.create({ 
                      userEmail: request.email, 
                      title: "Payment Rejected & Auto-Pay Disabled 🔴", 
                      description: `Your payout of ৳ ${request.amount} was rejected due to an invalid address or network error (${binanceRes.message}). Your balance has been refunded. Please update your Solana address and try again.`, 
                      type: "ERROR", 
                      color: "red" 
                  });
                  failCount++;
                }
              }
            } catch (e: any) {
              lockedReq.status = "PROCESSING";
              lockedReq.adminNote = "API Crash: " + e.message;
              await lockedReq.save();
              failCount++;
            }
          } else {
            lockedReq.status = "PAID";
            lockedReq.adminNote = "Manual Payment Completed.";
            await lockedReq.save();
            await Notification.create({ userEmail: request.email, title: "Payment Successful 🎉", description: `৳ ${request.amount} has been paid!`, type: "SUCCESS", color: "green" });
            successCount++;
          }
        } 
        else if (actionType === "PROCESS" && request.status === "PENDING") {
          request.status = "PROCESSING";
          request.adminNote = "Request is being verified...";
          await request.save();
          successCount++;
        }
      }
      return NextResponse.json({ success: true, message: `Bulk Executed: ${successCount} Success, ${failCount} Failed/Admin Error.` });
    }

    // 💥 3. UPDATE SINGLE STATUS 💥
    if (action === "UPDATE_STATUS") {
      if (newStatus === "PAID") {
         const request = await Withdraw.findOneAndUpdate(
             { _id: withdrawId, status: { $in: ["PROCESSING", "PENDING"] } }, 
             { $set: { status: "PAYING_LOCK" } }, 
             { new: true }
         );
         
         if (!request) return NextResponse.json({ success: false, message: "Request already processed or locked!" });

         if (request.method === "Binance") {
             try {
                 const rate = await getLiveUsdtRate();
                 const usdAmount = Number((request.amount / rate).toFixed(2));

                 const binanceRes = await sendBinancePay(request.accountNumber, usdAmount, request._id.toString());

                 if (binanceRes.success) {
                     request.status = "PAID";
                     request.adminNote = "Auto Paid. Binance TX Processed.";
                     await request.save();
                     await Notification.create({ userEmail: request.email, title: "Binance Payment Successful 🎉", description: `$${usdAmount} USDT has been sent!`, type: "SUCCESS", color: "green" });
                     return NextResponse.json({ success: true, message: `Binance Auto Pay Successful! Sent $${usdAmount}` });
                 } else {
                     const errorMsg = (binanceRes.message || "Unknown Binance Error").toLowerCase();
                     const adminKeywords = ["balance", "insufficient", "fund", "api key", "ip address", "permission", "unauthorized", "suspended"];
                     const isAdminFault = adminKeywords.some(kw => errorMsg.includes(kw));

                     if (isAdminFault) {
                         request.status = "PROCESSING"; 
                         request.adminNote = "Admin Issue: " + binanceRes.message;
                         await request.save();
                         return NextResponse.json({ success: false, message: `⚠️ Admin Binance Issue: ${binanceRes.message}` });
                     } else {
                         request.status = "REJECTED"; 
                         request.adminNote = "Binance Failed: " + binanceRes.message;
                         await request.save();
                         await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: request.amount }, $set: { isAutoWithdraw: false } });
                         
                         // 💥 FIXED: Detailed Notification Title & Description 💥
                         await Notification.create({ 
                             userEmail: request.email, 
                             title: "Payment Rejected & Auto-Pay Disabled 🔴", 
                             description: `Your payout of ৳ ${request.amount} was rejected due to an invalid address or network error (${binanceRes.message}). Your balance has been refunded. Please update your Solana address and try again.`, 
                             type: "ERROR", 
                             color: "red" 
                         });
                         return NextResponse.json({ success: false, message: `Binance Failed: ${binanceRes.message}. Refunded & Disabled.` });
                     }
                 }
             } catch (apiErr: any) {
                 request.status = "PROCESSING"; 
                 request.adminNote = "API Crash: " + apiErr.message;
                 await request.save();
                 return NextResponse.json({ success: false, message: `API Crash: ${apiErr.message}` });
             }
         }

         request.status = "PAID";
         request.adminNote = "Manual Payment Completed.";
         await request.save();
         await Notification.create({ userEmail: request.email, title: "Payment Successful 🎉", description: `৳ ${request.amount} has been paid!`, type: "SUCCESS", color: "green" });
         return NextResponse.json({ success: true, message: "Status updated to PAID" });
      }

      const request = await Withdraw.findById(withdrawId);
      if (!request) return NextResponse.json({ success: false, message: "Request not found!" });

      if (newStatus === "PROCESSING" && request.status !== "PROCESSING") {
         request.adminNote = "Request is being verified...";
         const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
         if (googleSheetUrl) fetch(googleSheetUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: request.date, name: request.name, email: request.email, amount: request.amount, method: request.method, accountNumber: request.accountNumber, status: "PROCESSING" }) }).catch(()=>{}); 
      }

      if (newStatus === "REJECTED" && request.status !== "REJECTED") {
         request.adminNote = "Rejected manually by Admin. Refunded & Auto-Pay Disabled.";
         await User.findOneAndUpdate(
            { email: request.email }, 
            { 
               $inc: { balance: request.amount }, 
               $set: { isAutoWithdraw: false } 
            }
         );
         // 💥 FIXED: Manual Reject Notification Details 💥
         await Notification.create({ 
            userEmail: request.email, 
            title: "Withdrawal Rejected & Auto-Pay Off 🔴", 
            description: `Admin rejected your payout of ৳ ${request.amount}. Your balance has been refunded and Auto-Pay is now disabled. Please check your payment details.`, 
            type: "ERROR", 
            color: "red" 
         });
      } 
      else if (request.status === "REJECTED" && newStatus !== "REJECTED") {
         request.adminNote = "Action Reversed by Admin.";
         const userCheck = await User.findOne({ email: request.email });
         if (!userCheck || userCheck.balance < request.amount) return NextResponse.json({ success: false, message: "Insufficient balance to undo!" }, { status: 400 });
         await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: -request.amount } });
      }

      request.status = newStatus;
      await request.save();
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
         const totalItems = await Withdraw.countDocuments(query);
         const requests = await Withdraw.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
         
         requests.forEach(r => r.amount = Number(r.amount.toFixed(2)));

         const pendingAgg = await Withdraw.aggregate([
             { $match: { status: { $in: ["PENDING", "PROCESSING"] } } }, 
             { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } }
         ]);
         
         const paidAgg = await Withdraw.aggregate([
             { $match: { status: "PAID" } }, 
             { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } }
         ]);
         
         const allAgg = await Withdraw.aggregate([
             { $group: { _id: null, total: { $sum: { $convert: { input: "$amount", to: "double", onError: 0, onNull: 0 } } } } }
         ]);
         
         const totalCount = await Withdraw.countDocuments();

         return NextResponse.json({ 
            success: true, 
            data: requests, 
            pagination: { total: totalItems, page, limit, totalPages: Math.ceil(totalItems / limit) || 1 },
            stats: { 
               totalRequests: totalCount, 
               pendingAmount: pendingAgg[0]?.total || 0, 
               paidAmount: paidAgg[0]?.total || 0, 
               totalAmount: allAgg[0]?.total || 0 
            }
         });
      } else {
         let requests = await Withdraw.find({ email }).sort({ createdAt: -1 });
         requests.forEach(r => r.amount = Number(r.amount.toFixed(2)));
         return NextResponse.json({ success: true, data: requests });
      }
    }
    return NextResponse.json({ success: false, message: "Invalid Request Action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}