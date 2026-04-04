import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../../../models/User"; 

export async function POST(req: NextRequest) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const token = req.cookies.get("zenex_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: No token found!" }, { status: 401 });
    }

    let realRequesterRole = "user";
    let realRequesterEmail = "";

    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      realRequesterRole = decodedPayload.role;
      realRequesterEmail = decodedPayload.email;
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token!" }, { status: 403 });
    }

    if (realRequesterRole === "user") {
      return NextResponse.json({ message: "🔴 ACCESS DENIED: Users cannot update accounts!" }, { status: 403 });
    }

    const body = await req.json();
    const { 
      userId, newPassword, newPin, newRate, newStatus, newRole, // 💥 newPin রিসিভ করা হলো
      customMail, contactLink, maxLimit, isApiActive 
    } = body;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: "User not found in database!" }, { status: 404 });
    }

    const isTargetAgent = newRole === "agent" || targetUser.role === "agent";

    if (realRequesterRole === "agent") {
       if (newRole === "admin") {
          return NextResponse.json({ message: "🔴 SECURITY ALERT: Agents cannot promote to Admin!" }, { status: 403 });
       }
       if (isApiActive !== undefined) {
          return NextResponse.json({ message: "🔴 SECURITY ALERT: Only Admins can enable Developer API!" }, { status: 403 });
       }

       const agent = await User.findOne({ email: realRequesterEmail });
       let maxR = agent?.agentMaxRate || 0;
       let otpR = agent?.otpRate || 0;
       let agentLimit = Math.max(maxR, otpR); 
       if (agentLimit === 0) agentLimit = 0.70; 
       
       if (newRate !== undefined && newRate !== null && newRate !== "" && parseFloat(newRate) > agentLimit) {
          return NextResponse.json({ 
            message: `🔴 SECURITY ALERT: You cannot set a rate higher than ৳ ${agentLimit.toFixed(2)}` 
          }, { status: 400 });
       }
    }

    let updateData: any = {};
    
    if (newStatus) updateData.status = newStatus.toLowerCase();
    
    if (newRate !== undefined && newRate !== null && newRate !== "") {
       updateData.otpRate = parseFloat(newRate);
       if (realRequesterRole === "admin" && isTargetAgent) {
          updateData.agentMaxRate = parseFloat(newRate);
       }
    }
    
    if (newRole && (realRequesterRole === "admin" || (realRequesterRole === "agent" && newRole !== "admin"))) {
       updateData.role = newRole;
    }

    if (newPassword && newPassword.trim() !== "") {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // 💥 ম্যাজিক: উইথড্র পিন রিসেট করার ফাংশন 💥
    if (newPin && newPin.trim() !== "") {
      updateData.withdrawPin = newPin.trim();
    }

    if (realRequesterRole === "admin" && isApiActive !== undefined) {
      updateData.isApiActive = isApiActive;
    }

    if (isTargetAgent) {
      if (customMail !== undefined) updateData.customAgentMail = customMail;
      if (contactLink !== undefined) updateData.telegramLink = contactLink;
      if (maxLimit !== undefined && realRequesterRole === "admin") {
         updateData.agentMaxUsers = parseInt(maxLimit); 
      }
    } else if (newRole === "user") {
      updateData.customAgentMail = "";
      updateData.telegramLink = "";
      updateData.agentMaxUsers = 100; 
    }

    await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, strict: false });

    return NextResponse.json({ message: "Account successfully and securely updated!" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `System Error: ${error.message}` }, { status: 500 });
  }
}