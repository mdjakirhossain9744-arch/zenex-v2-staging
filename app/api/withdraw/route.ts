import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Withdraw from "../../../models/Withdraw"; 
import User from "../../../models/User"; 
import PaymentSetting from "../../../models/PaymentSetting"; 

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json();
    const { action, email, name, role, amount, method, accountNumber, withdrawId, newStatus } = body;

    // 💥 ইউজার নতুন উইথড্র রিকোয়েস্ট দিলে 💥
    if (action === "CREATE") {
      
      // 🛡️ ১. হ্যাকার ইনপুট চেক (Negative Amount Hack Protection) 🛡️
      const safeAmount = Number(amount);
      if (!safeAmount || isNaN(safeAmount) || safeAmount < 100) {
        return NextResponse.json({ success: false, message: "Invalid amount. Minimum withdrawal is ৳ 100." }, { status: 400 });
      }

      // 🛡️ ২. ব্যাকএন্ড সিকিউরিটি চেক: সিস্টেম কি আসলেই ওপেন আছে? 🛡️
      const settings = await PaymentSetting.findOne({ type: "global" });
      if (settings) {
         if (settings.isWithdrawOpen === false) {
            return NextResponse.json({ success: false, message: "Withdrawals are currently closed by the Admin!" }, { status: 400 });
         }
         if (settings.methods && settings.methods[method as keyof typeof settings.methods] === false) {
            return NextResponse.json({ success: false, message: `${method} is currently disabled for withdrawals!` }, { status: 400 });
         }
      }

      // 🛡️ ৩. আল্ট্রা-সিকিউর রেস-কন্ডিশন প্রোটেকশন (Double Spending Hack Fix) 🛡️
      // MongoDB Atomic Operation: ডাটাবেস নিজে চেক করে টাকা কাটবে, ফলে সেকেন্ডে ১০০ টা রিকোয়েস্ট আসলেও ডাটাবেস একবারই কাটবে!
      const updatedUser = await User.findOneAndUpdate(
        { email: email, balance: { $gte: safeAmount } }, // শর্ত: ব্যালেন্স অবশ্যই রিকোয়েস্ট করা এমাউন্টের সমান বা বেশি হতে হবে
        { $inc: { balance: -safeAmount } }, // শর্ত মিললে ব্যালেন্স থেকে টাকাটা মাইনাস করে দেবে
        { new: true } // আপডেট হওয়া নতুন ডাটা রিটার্ন করবে
      );

      if (!updatedUser) {
        // যদি শর্ত না মিলে (অর্থাৎ ব্যালেন্স কম থাকে বা একই সাথে ডাবল রিকোয়েস্ট আসে)
        return NextResponse.json({ success: false, message: "Insufficient Balance or Invalid Request!" }, { status: 400 });
      }

      // যেহেতু টাকা সফলভাবে কাটা হয়েছে, এখন উইথড্র লিস্টে অ্যাড করা হচ্ছে
      const newWithdraw = new Withdraw({
        email, name, role, amount: safeAmount, method, accountNumber, 
        date: new Date().toLocaleDateString('en-GB')
      });
      await newWithdraw.save();
      
      return NextResponse.json({ success: true, message: "Withdraw request submitted!" });
    }

    // 💥 এডমিন পেমেন্ট Paid/Reject করলে 💥
    if (action === "UPDATE_STATUS") {
      const request = await Withdraw.findById(withdrawId);
      if (!request) return NextResponse.json({ success: false, message: "Request not found!" });

      // 🛡️ রিজেক্ট করলে ব্যালেন্স ব্যাক (Atomic Operation)
      if (newStatus === "REJECTED" && request.status !== "REJECTED") {
         await User.findOneAndUpdate(
           { email: request.email },
           { $inc: { balance: request.amount } } // ব্যালেন্সে টাকা প্লাস করে দেওয়া হলো
         );
      } 
      // 🛡️ রিজেক্ট থেকে আবার পেইড/পেন্ডিং করলে ব্যালেন্স কাটবে
      else if (request.status === "REJECTED" && newStatus !== "REJECTED") {
         const userCheck = await User.findOne({ email: request.email });
         if (!userCheck || userCheck.balance < request.amount) {
           return NextResponse.json({ success: false, message: "User doesn't have enough balance to undo rejection!" }, { status: 400 });
         }
         await User.findOneAndUpdate(
           { email: request.email },
           { $inc: { balance: -request.amount } } // ব্যালেন্স থেকে টাকা মাইনাস করে দেওয়া হলো
         );
      }

      request.status = newStatus;
      await request.save();
      return NextResponse.json({ success: true, message: `Status updated to ${newStatus}` });
    }

    // 💥 ডাটা ফেচ করা 💥
    if (action === "FETCH") {
      let requests;
      if (role === "admin") {
        requests = await Withdraw.find().sort({ createdAt: -1 });
      } else {
        requests = await Withdraw.find({ email }).sort({ createdAt: -1 });
      }
      return NextResponse.json({ success: true, data: requests });
    }

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}