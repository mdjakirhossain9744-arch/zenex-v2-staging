import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectToDatabase from "../../lib/mongodb";
import User from "../../../models/User";

const JWT_SECRET = process.env.JWT_SECRET || "ZENEX_SUPER_SECRET_KEY_2024";

export const dynamic = "force-dynamic"; // Vercel Caching Issue ফিক্স করার জন্য

export async function GET(req: NextRequest) {
  try {
    // সরাসরি রিকোয়েস্ট থেকে কুকি রিড করা হচ্ছে
    const token = req.cookies.get("zenex_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "No token found" }, { status: 401 });
    }

    // 💥 ১. টোকেন ভেরিফিকেশন (এখানে ফেইল করলে তবেই 401 দিয়ে লগআউট করাবে) 💥
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; sessionId: string };
    } catch (jwtError) {
      return NextResponse.json({ message: "Invalid or Expired Token" }, { status: 401 });
    }

    // 💥 ২. ডাটাবেস কানেকশন (এখানে স্লো হলে 500 দেবে, লগআউট করাবে না) 💥
    try {
      await connectToDatabase();
      
      const user = await User.findById(decoded.id).select("activeSessions status").lean();

      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 401 });
      }

      if (user.status === "banned" || user.status === "pending") {
         return NextResponse.json({ message: "Account restricted" }, { status: 401 });
      }

      // সেশন আইডি চেক (ম্যাক্স ৫ ডিভাইসের লজিক)
      if (!user.activeSessions || !user.activeSessions.includes(decoded.sessionId)) {
        return NextResponse.json({ message: "Logged in from another device. Session expired." }, { status: 401 });
      }

      return NextResponse.json({ message: "Session is valid" }, { status: 200 });

    } catch (dbError) {
      // 💥 আসল ফিক্স: ডাটাবেস স্লো হলে বা লোড নিতে না পারলে ইউজারকে লগআউট করবে না! 💥
      console.warn("DB Timeout in check-session. Skipping logout.");
      return NextResponse.json({ message: "Database busy, skipping check" }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}