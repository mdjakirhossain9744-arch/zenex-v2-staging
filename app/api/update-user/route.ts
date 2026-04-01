import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import User from "../../../models/User"; 

export async function POST(req: Request) {
  try {
    // 💥 ১. DATABASE CONNECTION 💥
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    // 💥 ২. JWT SIGNATURE VERIFICATION (হ্যাকার প্রটেকশন) 💥
    // ফ্রন্টএন্ডের ডাটা বিশ্বাস না করে কুকি থেকে আসল পরিচয় বের করা হচ্ছে
    const cookieStore = cookies();
    const token = cookieStore.get("zenex_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: No token found!" }, { status: 401 });
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET as string);
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid or Fake Token!" }, { status: 403 });
    }

    // টোকেন থেকে আসল ইমেইল এবং রোল বের করা হলো
    const realRequesterRole = decodedToken.role;
    const realRequesterEmail = decodedToken.email;

    // সাধারণ ইউজার এই API হিট করলে সরাসরি লাথি খাবে
    if (realRequesterRole === "user") {
      return NextResponse.json({ message: "🔴 ACCESS DENIED: Users cannot update accounts!" }, { status: 403 });
    }

    // 💥 ৩. PARSE REQUEST DATA 💥
    const body = await req.json();
    const { 
      userId, newPassword, newRate, newStatus, newRole, 
      customMail, contactLink, maxLimit, isApiActive 
    } = body;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ message: "User not found in database!" }, { status: 404 });
    }

    const isTargetAgent = newRole === "agent" || targetUser.role === "agent";

    // 💥 ৪. AGENT SECURITY & IDOR PROTECTION 💥
    if (realRequesterRole === "agent") {
       // হ্যাক প্রটেকশন ১: এজেন্ট কি অন্য এজেন্টের ইউজার চেঞ্জ করতে চাচ্ছে?
       if (targetUser.agentEmail !== realRequesterEmail && targetUser.agentEmail !== decodedToken.customAgentMail) {
          return NextResponse.json({ message: "🔴 SECURITY ALERT: You can only update your own network users!" }, { status: 403 });
       }

       // হ্যাক প্রটেকশন ২: এজেন্ট কি নিজেকে বা অন্যকে এডমিন বানাতে চাচ্ছে?
       if (newRole === "admin") {
          return NextResponse.json({ message: "🔴 SECURITY ALERT: Agents cannot promote users to Admin!" }, { status: 403 });
       }

       // হ্যাক প্রটেকশন ৩: এজেন্ট কি ইউজারের API অন করতে চাচ্ছে? (API শুধু এডমিন অন করতে পারবে)
       if (isApiActive !== undefined) {
          return NextResponse.json({ message: "🔴 SECURITY ALERT: Only Admins can enable Developer API!" }, { status: 403 });
       }

       // হ্যাক প্রটেকশন ৪: এজেন্ট কি নিজের রেটের চেয়ে বেশি রেট দিতে চাচ্ছে?
       const agent = await User.findOne({ email: realRequesterEmail });
       let maxR = agent?.agentMaxRate || 0;
       let otpR = agent?.otpRate || 0;
       let agentLimit = Math.max(maxR, otpR); 
       if (agentLimit === 0) agentLimit = 0.70; 
       
       if (newRate && parseFloat(newRate) > agentLimit) {
          return NextResponse.json({ 
            message: `🔴 SECURITY ALERT: You cannot set a rate higher than your limit (৳ ${agentLimit.toFixed(2)})` 
          }, { status: 400 });
       }
    }

    // 💥 ৫. PREPARE SECURE UPDATE DATA 💥
    let updateData: any = {};
    
    if (newStatus) updateData.status = newStatus.toLowerCase();
    
    if (newRate) {
       updateData.otpRate = parseFloat(newRate);
       // এডমিন যদি এজেন্টের রেট চেঞ্জ করে, তবে সেটাই তার লিমিট হয়ে যাবে
       if (realRequesterRole === "admin" && isTargetAgent) {
          updateData.agentMaxRate = parseFloat(newRate);
       }
    }
    
    // শুধুমাত্র এডমিন রোল চেঞ্জ করে এডমিন বানাতে পারবে
    if (newRole && (realRequesterRole === "admin" || (realRequesterRole === "agent" && newRole !== "admin"))) {
       updateData.role = newRole;
    }

    if (newPassword && newPassword.trim() !== "") {
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // শুধুমাত্র এডমিন API Access অন/অফ করতে পারবে
    if (realRequesterRole === "admin" && isApiActive !== undefined) {
      updateData.isApiActive = isApiActive;
    }

    if (isTargetAgent) {
      if (customMail !== undefined) updateData.customAgentMail = customMail;
      if (contactLink !== undefined) updateData.telegramLink = contactLink;
      if (maxLimit !== undefined && realRequesterRole === "admin") {
         updateData.agentMaxUsers = parseInt(maxLimit); // এজেন্টের সিট লিমিট শুধু এডমিন বাড়াতে পারবে
      }
    } else if (newRole === "user") {
      updateData.customAgentMail = "";
      updateData.telegramLink = "";
      updateData.agentMaxUsers = 100; 
    }

    // 💥 ৬. SAVE TO DATABASE 💥
    await User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, strict: false });

    return NextResponse.json({ message: "Account successfully and securely updated!" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ message: `System Error: ${error.message}` }, { status: 500 });
  }
}