export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // 💥 হ্যাকার প্রটেকশন: JWT ভেরিফিকেশন (শুধুমাত্র এডমিন এক্সেস পাবে) 💥
    const cookieStore = cookies();
    const token = cookieStore.get("zenex_token")?.value;
    
    if (!token) {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: Token missing" }, { status: 401 });
    }

    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      if (decoded.role !== "admin") {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Admins only!" }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token!" }, { status: 403 });
    }

    await connectToDatabase();
    
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });

    const formattedUsers = users.map(u => ({
      id: u._id,
      uid: `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`,
      name: u.fullName,
      email: u.email,
      role: u.role,
      agentEmail: u.agentEmail || "Admin",
      balance: u.balance || 0,
      status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
      todayOTP: 0, // এটা লাইভ হিসেব করা হবে
      rate: u.otpRate || "0.50",
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