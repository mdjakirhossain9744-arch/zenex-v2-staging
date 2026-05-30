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

    // 💥 1. CREATE CUSTOM WITHDRAW (MANUAL GATE) 💥
    if (action === "CREATE") {
      const safeAmount = Number(amount);
      if (!safeAmount || isNaN(safeAmount) || safeAmount < 100) return NextResponse.json({ success: false, message: "Invalid amount. Minimum withdrawal is ৳ 100." }, { status: 400 });
      if (!withdrawPin) return NextResponse.json({ success: false, message: "Security PIN is required!" }, { status: 400 });

      const user = await User.findOne({ email });
      if (!user) return NextResponse.json({ success: false, message: "User not found!" }, { status: 404 });
      
      if ((user.withdrawPin || "1234") !== withdrawPin.trim()) return NextResponse.json({ success: false, message: "🔴 Invalid Security PIN! Request Denied." }, { status: 403 });

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

      const newWithdraw = new Withdraw({ email, name, role, amount: safeAmount, method, accountNumber, date: new Date().toLocaleDateString('en-GB') });
      await newWithdraw.save();
      return NextResponse.json({ success: true, message: "Withdraw request submitted successfully!" });
    }

    // 💥 2. UPDATE STATUS & SMART BINANCE LOGIC 💥
    if (action === "UPDATE_STATUS") {
      if (newStatus === "PAID") {
         const request = await Withdraw.findOneAndUpdate(
             { _id: withdrawId, status: "PROCESSING" }, 
             { $set: { status: "PAYING_LOCK" } }, 
             { new: true }
         );
         
         if (!request) return NextResponse.json({ success: false, message: "Request already processed or locked!" });

         // 💥 BINANCE API EXECUTION (Strong Try-Catch) 💥
         if (request.method === "Binance") {
             try {
                 const rate = await getLiveUsdtRate();
                 const usdAmount = Number((request.amount / rate).toFixed(2));

                 const binanceRes = await sendBinancePay(request.accountNumber, usdAmount, request._id.toString());

                 if (binanceRes.success) {
                     request.status = "PAID";
                     await request.save();
                     await Notification.create({ userEmail: request.email, title: "Binance Payment Successful 🎉", description: `$${usdAmount} USDT has been sent!`, type: "SUCCESS", color: "green" });
                     return NextResponse.json({ success: true, message: `Binance Auto Pay Successful! Sent $${usdAmount}` });
                 } else {
                     const errorMsg = (binanceRes.message || "").toLowerCase();
                     
                     // 🟡 SMART CHECK: Insufficient balance
                     if (errorMsg.includes("balance") || errorMsg.includes("fund") || errorMsg.includes("insufficient")) {
                         request.status = "PROCESSING"; // Revert lock
                         await request.save();
                         return NextResponse.json({ success: false, message: `⚠️ Admin Binance Wallet Empty! Top up USDT.` });
                     } 
                     // 🔴 SMART CHECK: Invalid ID
                     else {
                         request.status = "REJECTED"; 
                         await request.save();
                         await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: request.amount } });
                         await Notification.create({ 
                             userEmail: request.email, 
                             title: "Binance Payment Failed 🔴", 
                             description: `Invalid Binance ID/Email. ৳ ${request.amount} has been refunded to your balance!`, 
                             type: "ERROR", 
                             color: "red" 
                         });
                         return NextResponse.json({ success: false, message: `Binance Failed: Invalid ID. Amount Auto-Refunded to User.` });
                     }
                 }
             } catch (apiErr: any) {
                 // 🔴 CRASH CATCHER: If API Keys are wrong or Network Fails
                 request.status = "PROCESSING"; // Revert lock so it doesn't get stuck
                 await request.save();
                 return NextResponse.json({ success: false, message: `API Crash: ${apiErr.message}` });
             }
         }

         // 💥 Manual Gateway (bKash/Nagad) Success
         request.status = "PAID";
         await request.save();
         await Notification.create({ userEmail: request.email, title: "Payment Successful 🎉", description: `৳ ${request.amount} has been paid!`, type: "SUCCESS", color: "green" });
         return NextResponse.json({ success: true, message: "Status updated to PAID" });
      }

      // 💥 3. MANUAL REJECT & REFUND LOGIC 💥
      const request = await Withdraw.findById(withdrawId);
      if (!request) return NextResponse.json({ success: false, message: "Request not found!" });

      if (newStatus === "PROCESSING" && request.status !== "PROCESSING") {
         const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
         if (googleSheetUrl) {
            fetch(googleSheetUrl, {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ date: request.date || new Date().toLocaleDateString('en-GB'), name: request.name, email: request.email, amount: request.amount, method: request.method, accountNumber: request.accountNumber, status: "PROCESSING" })
            }).catch(()=>{}); 
         }
      }

      if (newStatus === "REJECTED" && request.status !== "REJECTED") {
         await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: request.amount } });
         await Notification.create({ userEmail: request.email, title: "Withdrawal Rejected", description: `Your ৳ ${request.amount} request was rejected and refunded.`, type: "WARNING", color: "red" });
      } 
      else if (request.status === "REJECTED" && newStatus !== "REJECTED") {
         const userCheck = await User.findOne({ email: request.email });
         if (!userCheck || userCheck.balance < request.amount) return NextResponse.json({ success: false, message: "User doesn't have balance to undo!" }, { status: 400 });
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

         const pendingAgg = await Withdraw.aggregate([{ $match: { status: { $in: ["PENDING", "PROCESSING"] } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
         const paidAgg = await Withdraw.aggregate([{ $match: { status: "PAID" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
         const allAgg = await Withdraw.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]);
         const totalCount = await Withdraw.countDocuments();

         return NextResponse.json({ 
            success: true, 
            data: requests,
            pagination: { total: totalItems, page, limit, totalPages: Math.ceil(totalItems / limit) || 1 },
            stats: { totalRequests: totalCount, pendingAmount: pendingAgg[0]?.total || 0, paidAmount: paidAgg[0]?.total || 0, totalAmount: allAgg[0]?.total || 0 }
         });
      } else {
         let requests = await Withdraw.find({ email }).sort({ createdAt: -1 });
         return NextResponse.json({ success: true, data: requests });
      }
    }

    return NextResponse.json({ success: false, message: "Invalid Request Action" }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}