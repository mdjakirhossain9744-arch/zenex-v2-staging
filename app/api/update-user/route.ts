import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../../../models/User"; 

export async function POST(req: Request) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json();
    const { 
      userId, newPassword, newRate, newStatus, newRole, 
      customMail, contactLink, maxLimit, 
      requesterEmail, requesterRole 
    } = body;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: "User not found in database!" }, { status: 404 });
    }

    const isTargetAgent = newRole === "agent" || targetUser.role === "agent";

    // 💥 মেইন ফিক্স: ব্যাকএন্ডেও ফ্রন্টএন্ডের মতো সেম লজিক বসানো হলো 💥
    if (requesterRole === "agent" && requesterEmail) {
       const agent = await User.findOne({ email: requesterEmail });
       
       let maxR = agent?.agentMaxRate || 0;
       let otpR = agent?.otpRate || 0;
       let agentLimit = Math.max(maxR, otpR); // ডাটাবেসের যেটা বড় সেটাই লিমিট হবে
       if (agentLimit === 0) agentLimit = 0.70; // ডিফল্ট
       
       if (parseFloat(newRate) > agentLimit) {
          return NextResponse.json({ 
            message: `🔴 SECURITY ALERT: You cannot set a rate higher than ৳ ${agentLimit.toFixed(2)}` 
          }, { status: 400 });
       }
    }

    let updateData: any = {};
    
    if (newStatus) updateData.status = newStatus.toLowerCase();
    
    if (newRate) {
       updateData.otpRate = parseFloat(newRate);
       
       // এডমিন যদি এজেন্টের রেট চেঞ্জ করে, তবে সেটাই তার লিমিট হয়ে যাবে
       if (requesterRole === "admin" && isTargetAgent) {
          updateData.agentMaxRate = parseFloat(newRate);
       }
    }
    
    if (newRole) updateData.role = newRole;

    if (newPassword && newPassword.trim() !== "") {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (isTargetAgent) {
      if (customMail !== undefined) updateData.customAgentMail = customMail;
      if (contactLink !== undefined) updateData.telegramLink = contactLink;
      if (maxLimit !== undefined) updateData.agentMaxUsers = parseInt(maxLimit); 
    } else if (newRole === "user") {
      updateData.customAgentMail = "";
      updateData.telegramLink = "";
      updateData.agentMaxUsers = 100; 
    }

    await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, strict: false });

    return NextResponse.json({ message: "Account updated successfully!" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `System Error: ${error.message}` }, { status: 500 });
  }
}