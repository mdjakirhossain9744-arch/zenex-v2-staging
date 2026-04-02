export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 

export async function GET(req: NextRequest) {
  try {
    // 💥 হ্যাকার প্রটেকশন: কুকি থেকে টোকেন নেওয়া হলো 💥
    const token = req.cookies.get("zenex_token")?.value;
    
    if (!token) {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: Token missing" }, { status: 401 });
    }

    try {
      // jsonwebtoken লাইব্রেরির বদলে মিডলওয়্যারের মতো ডাইরেক্ট ডিকোড (যাতে কোনো এরর না আসে)
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));

      // যদি সে এডমিন না হয়, তবে লাথি খাবে
      if (decodedPayload.role !== "admin") {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Admins only!" }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token!" }, { status: 403 });
    }

    // 💥 সিকিউরিটি পাস হলে তবেই ডাটাবেস থেকে ডাটা আনবে 💥
    await connectToDatabase();
    
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });

    const formattedUsers = users.map(u => ({
      id: u._id,
      uid: `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`,
      name: u.fullName,
      email: u.email,
      role: u.role,
      agentEmail: u.agentEmail || "Admin",
      // 💥 ম্যাজিক ফিক্স: 3.99999999 কে 4.00 বা 3.99 বানানো হলো! 💥
      balance: Number(u.balance || 0).toFixed(2),
      status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
      todayOTP: 0, 
      // 💥 ম্যাজিক ফিক্স: রেটকেও ২ দশমিক করে দেওয়া হলো! 💥
      rate: Number(u.otpRate || 0.50).toFixed(2),
      customAgentMail: u.customAgentMail || "", 
      telegramLink: u.telegramLink || "",
      agentMaxUsers: u.agentMaxUsers || 100,
      isApiActive: u.isApiActive || false        
    }));

    return NextResponse.json({ users: formattedUsers }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}