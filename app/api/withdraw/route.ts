import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Withdraw from "../../../models/Withdraw"; 
import User from "../../../models/User"; 
import PaymentSetting from "../../../models/PaymentSetting"; 
import Notification from "../../../models/Notification";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // 💥 CRASH FIX: Strong DB Connection Check
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    // 💥 CRASH FIX: Safe JSON Parse
    const body = await req.json().catch(() => ({}));
    const { action, email, name, role, amount, method, accountNumber, withdrawPin, withdrawId, newStatus, selectedIds, actionType } = body; 

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

      const updatedUser = await User.findOneAndUpdate({ email: email, balance: { $gte: safeAmount } }, { $inc: { balance: -safeAmount } }, { new: true });
      if (!updatedUser) return NextResponse.json({ success: false, message: "Insufficient Balance!" }, { status: 400 });

      const newWithdraw = new Withdraw({ email, name, role, amount: safeAmount, method, accountNumber, date: new Date().toLocaleDateString('en-GB') });
      await newWithdraw.save();
      return NextResponse.json({ success: true, message: "Withdraw request submitted successfully!" });
    }

    if (action === "UPDATE_STATUS") {
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
         await Notification.create({ userEmail: request.email, title: "Withdrawal Rejected", description: `Your ৳ ${request.amount} request was rejected.`, type: "WARNING", color: "red" });
      } else if (request.status === "REJECTED" && newStatus !== "REJECTED") {
         const userCheck = await User.findOne({ email: request.email });
         if (!userCheck || userCheck.balance < request.amount) return NextResponse.json({ success: false, message: "User doesn't have balance to undo!" }, { status: 400 });
         await User.findOneAndUpdate({ email: request.email }, { $inc: { balance: -request.amount } });
      }

      if (newStatus === "PAID" && request.status !== "PAID") {
         await Notification.create({ userEmail: request.email, title: "Payment Successful 🎉", description: `৳ ${request.amount} has been paid!`, type: "SUCCESS", color: "green" });
      }

      request.status = newStatus;
      await request.save();
      return NextResponse.json({ success: true, message: `Status updated to ${newStatus}` });
    }

    if (action === "BULK_ACTION") {
       if (!selectedIds || selectedIds.length === 0) return NextResponse.json({ success: false });

       if (actionType === "PROCESS") {
          await Withdraw.updateMany({ _id: { $in: selectedIds } }, { $set: { status: "PROCESSING" } });
          const googleSheetUrl = process.env.GOOGLE_SHEET_WEBHOOK;
          if (googleSheetUrl) {
             const requests = await Withdraw.find({ _id: { $in: selectedIds } });
             requests.forEach(req => fetch(googleSheetUrl, { method: "POST", body: JSON.stringify({ date: req.date, name: req.name, email: req.email, amount: req.amount, method: req.method, accountNumber: req.accountNumber, status: "PROCESSING" }) }).catch(()=>{}));
          }
          return NextResponse.json({ success: true, message: `${selectedIds.length} Requests moved to Processing!` });
       } 
       else if (actionType === "PAID") {
          await Withdraw.updateMany({ _id: { $in: selectedIds } }, { $set: { status: "PAID" } });
          const requests = await Withdraw.find({ _id: { $in: selectedIds } });
          const notifications = requests.map(req => ({ userEmail: req.email, title: "Payment Successful 🎉", description: `৳ ${req.amount} has been paid!`, type: "SUCCESS", color: "green" }));
          if (notifications.length > 0) await Notification.insertMany(notifications);
          return NextResponse.json({ success: true, message: `${selectedIds.length} Payments Approved!` });
       }
    }

    if (action === "FETCH") {
      if (role === "admin") {
         const { tab = "PENDING", timeFilter = "ALL", searchQuery = "", page = 1, limit = 50 } = body;
         let query: any = {};
         
         if (tab === "PENDING") query.status = "PENDING";
         if (tab === "PROCESSING") query.status = "PROCESSING";
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