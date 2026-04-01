// ফোল্ডার লোকেশন: app/api/leaderboard/route.ts

import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import User from "../../../models/User";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json().catch(() => ({}));
    const { action, email, bannerActive, bannerText, bannerPrize } = body;

    // 💥 ১. রিয়েল ইউজার ডাটা এবং র‍্যাংকিং ফেচ করা 💥
    if (action === "FETCH") {
      // ডাটাবেস থেকে শুধু অ্যাক্টিভ ইউজারদের আনা হচ্ছে এবং todayOTP অনুযায়ী সাজানো হচ্ছে
      const allUsers = await User.find({ role: "user", status: "active" })
                                 .select("fullName email todayOTP")
                                 .sort({ todayOTP: -1 })
                                 .limit(300); // সর্বোচ্চ ৩০০ জনের লিস্ট আনবে

      const topUsersList = allUsers.map((u, index) => ({
         rank: index + 1,
         name: u.fullName || "Unknown User",
         email: u.email,
         score: u.todayOTP || 0
      }));

      // ইউজারের নিজের র‍্যাংক বের করা
      let myRank = { rank: 0, name: "Not Ranked", score: 0 };
      if (email) {
         const myIndex = topUsersList.findIndex(u => u.email === email);
         if (myIndex !== -1) {
            myRank = { 
              rank: topUsersList[myIndex].rank, 
              name: topUsersList[myIndex].name, 
              score: topUsersList[myIndex].score 
            };
         }
      }

      // MongoDB Native Collection দিয়ে অফার ব্যানার সেটিংস আনা হচ্ছে
      const db = mongoose.connection.db;
      let settings = null;
      if (db) {
         settings = await db.collection("custom_settings").findOne({ type: "leaderboard" });
      }
      
      if (!settings) {
        settings = { 
           bannerActive: false, 
           bannerText: "Top 1 user at the end of the week receives", 
           bannerPrize: "1000 BDT" 
        };
      }

      return NextResponse.json({ success: true, topUsersList, myRank, settings });
    }

    // 💥 ২. এডমিন কন্ট্রোল: অফার ব্যানার আপডেট করা 💥
    if (action === "UPDATE_BANNER") {
      const token = req.cookies.get("zenex_token")?.value;
      if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      if (decoded.role !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

      const db = mongoose.connection.db;
      if (db) {
         await db.collection("custom_settings").updateOne(
            { type: "leaderboard" },
            { $set: { type: "leaderboard", bannerActive, bannerText, bannerPrize } },
            { upsert: true }
         );
      }

      return NextResponse.json({ success: true, message: "Banner Settings Updated!" });
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}