import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Withdraw from "../../../models/Withdraw"; 
import User from "../../../models/User"; 
import PaymentSetting from "../../../models/PaymentSetting"; // 💥 নতুন: সেটিংস চেক করার জন্য

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json();
    const { action, email, name, role, amount, method, accountNumber, withdrawId, newStatus } = body;

    // 💥 ইউজার নতুন উইথড্র রিকোয়েস্ট দিলে 💥
    if (action === "CREATE") {
      
      // 🛡️ ব্যাকএন্ড সিকিউরিটি চেক: সিস্টেম কি আসলেই ওপেন আছে? 🛡️
      const settings = await PaymentSetting.findOne({ type: "global" });
      if (settings) {
         // ১. যদি এডমিন মেইন সুইচ অফ করে রাখে
         if (settings.isWithdrawOpen === false) {
            return NextResponse.json({ success: false, message: "Withdrawals are currently closed by the Admin!" }, { status: 400 });
         }
         // ২. যদি এডমিন নির্দিষ্ট মেথড (যেমন: bKash) অফ করে রাখে
         if (settings.methods && settings.methods[method as keyof typeof settings.methods] === false) {
            return NextResponse.json({ success: false, message: `${method} is currently disabled for withdrawals!` }, { status: 400 });
         }
      }

      // ব্যালেন্স চেক
      const user = await User.findOne({ email });
      if (!user || user.balance < amount) {
        return NextResponse.json({ success: false, message: "Insufficient Balance!" }, { status: 400 });
      }

      // ব্যালেন্স কেটে নেওয়া
      user.balance -= amount;
      await user.save();

      // উইথড্র লিস্টে অ্যাড করা
      const newWithdraw = new Withdraw({
        email, name, role, amount, method, accountNumber, 
        date: new Date().toLocaleDateString('en-GB')
      });
      await newWithdraw.save();
      
      return NextResponse.json({ success: true, message: "Withdraw request submitted!" });
    }

    // 💥 এডমিন পেমেন্ট Paid/Reject করলে 💥
    if (action === "UPDATE_STATUS") {
      const request = await Withdraw.findById(withdrawId);
      if (!request) return NextResponse.json({ success: false, message: "Request not found!" });

      // রিজেক্ট করলে ব্যালেন্স ব্যাক
      if (newStatus === "REJECTED" && request.status !== "REJECTED") {
         const user = await User.findOne({ email: request.email });
         if (user) {
            user.balance += request.amount;
            await user.save();
         }
      } 
      // রিজেক্ট থেকে আবার পেইড/পেন্ডিং করলে ব্যালেন্স কাটবে
      else if (request.status === "REJECTED" && newStatus !== "REJECTED") {
         const user = await User.findOne({ email: request.email });
         if (user) {
            user.balance -= request.amount;
            await user.save();
         }
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