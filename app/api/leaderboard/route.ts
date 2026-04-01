import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import User from "../../../models/User";

export async function POST(req: NextRequest) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }

    const body = await req.json().catch(() => ({}));
    const { action, email, isLeaderboardOpen, bannerActive, bannerText, bannerPrize } = body;

    // 💥 ১. FETCH DATA 💥
    if (action === "FETCH") {
      const allUsers = await User.find({ role: "user", status: "active" })
                                 .select("fullName email todayOTP")
                                 .sort({ todayOTP: -1 })
                                 .limit(300);

      const topUsersList = allUsers.map((u, index) => ({
         rank: index + 1,
         name: u.fullName || "Unknown User",
         email: u.email,
         score: u.todayOTP || 0
      }));

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

      const db = mongoose.connection.db;
      let settings = null;
      if (db) {
         settings = await db.collection("custom_settings").findOne({ type: "leaderboard" });
      }
      
      if (!settings) {
        settings = { 
           isLeaderboardOpen: true, 
           bannerActive: false, 
           bannerText: "Top 1 user at the end of the week receives", 
           bannerPrize: "1000 BDT" 
        };
      }

      return NextResponse.json({ success: true, topUsersList, myRank, settings });
    }

    // 💥 ২. ADMIN UPDATE (Error Fixed using Buffer) 💥
    if (action === "UPDATE_BANNER") {
      const token = req.cookies.get("zenex_token")?.value;
      if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
      
      let userRole = "user";
      try {
        const payloadBase64 = token.split('.')[1];
        // 💥 স্ট্রং ডিকোড সিস্টেম (ক্র্যাশ করবে না) 💥
        const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
        userRole = decoded.role;
      } catch(e) {
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      if (userRole !== "admin") return NextResponse.json({ message: "Forbidden" }, { status: 403 });

      const db = mongoose.connection.db;
      if (db) {
         await db.collection("custom_settings").updateOne(
            { type: "leaderboard" },
            { $set: { type: "leaderboard", isLeaderboardOpen, bannerActive, bannerText, bannerPrize } },
            { upsert: true }
         );
      }

      return NextResponse.json({ success: true, message: "Settings Updated Successfully!" });
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}