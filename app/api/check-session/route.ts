import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectToDatabase from "../../lib/mongodb";
import User from "../../../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "ZENEX_SUPER_SECRET_KEY_2024";

// 💥 req: NextRequest ব্যবহার করা হয়েছে যাতে Promise Error না আসে 💥
export async function GET(req: NextRequest) {
  try {
    // সরাসরি রিকোয়েস্ট থেকে কুকি রিড করা হচ্ছে
    const token = req.cookies.get("zenex_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "No token found" }, { status: 401 });
    }

    // ১. টোকেন ডিকোড করে ইউজারের আইডি এবং বর্তমান সেশন আইডি বের করা
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; sessionId: string };

    await connectToDatabase();
    
    // ২. ইউজারের ডাটাবেস চেক করা
    const user = await User.findById(decoded.id).select("activeSessions status");

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 401 });
    }

    // ইউজার ব্যান হলে কিক আউট
    if (user.status === "banned") {
       return NextResponse.json({ message: "Account banned" }, { status: 401 });
    }

    // ৩. 💥 আসল ম্যাজিক: বর্তমান সেশন আইডি যদি ডাটাবেসের সেশন লিস্টে না থাকে, তবে লাথি মারো!
    if (!user.activeSessions || !user.activeSessions.includes(decoded.sessionId)) {
      return NextResponse.json({ message: "Session expired or logged in from another device" }, { status: 401 });
    }

    return NextResponse.json({ message: "Session is valid" }, { status: 200 });

  } catch (error) {
    return NextResponse.json({ message: "Invalid session" }, { status: 401 });
  }
}