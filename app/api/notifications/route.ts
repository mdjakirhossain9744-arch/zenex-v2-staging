import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import Notification from "../../../models/Notification";

const getUserRole = (req: NextRequest) => {
  const token = req.cookies.get("zenex_token")?.value;
  if (!token) return "user";
  try {
    const payloadBase64 = token.split('.')[1];
    const decoded = JSON.parse(atob(payloadBase64));
    return decoded.role;
  } catch (e) {
    return "user";
  }
};

export async function POST(req: NextRequest) {
  try {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI as string);
    }
    const body = await req.json().catch(() => ({}));
    
    const { action, id, title, description, type, color, reactionType, fetchType, email, noticeType } = body;
    
    const role = getUserRole(req);

    // 💥 ১. Sidebar Notification Page-এর জন্য নোটিশ ফেচ করা (GLOBAL & PERSONAL আলাদা) 💥
    if (action === "FETCH") {
      let query: any = {};
      if (fetchType === "GLOBAL") {
         query = { userEmail: "global" };
      } else if (fetchType === "PERSONAL") {
         if (!email) return NextResponse.json({ success: false, message: "Email required for personal notices" });
         query = { userEmail: email };
      }

      const notifs = await Notification.find(query).sort({ createdAt: -1 }).limit(50);
      return NextResponse.json({ success: true, data: notifs });
    }

    // 💥 ২. Header Bell Icon-এর জন্য নোটিশ ফেচ করা (গ্লোবাল + পার্সোনাল) 💥
    if (action === "FETCH_HEADER") {
      if (!email) return NextResponse.json({ success: false, message: "Email required for personal notices" });
      
      const notifs = await Notification.find({
        $or: [
          { userEmail: "global" }, 
          { userEmail: email }     
        ]
      })
      .sort({ createdAt: -1 })
      .limit(10); 

      return NextResponse.json({ success: true, data: notifs });
    }

    // 💥 ৩. এডমিনের জন্য নোটিশ তৈরি করা (সবসময় গ্লোবাল হবে) 💥
    if (action === "CREATE") {
      if (role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
      
      const newNotif = new Notification({ 
        title, 
        description, 
        type, 
        color,
        userEmail: "global", 
        noticeType: noticeType || "GLOBAL"
      });
      await newNotif.save();
      return NextResponse.json({ success: true });
    }

    // 💥 ৪. নোটিশ ডিলিট করা 💥
    if (action === "DELETE") {
      if (role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
      await Notification.findByIdAndDelete(id);
      return NextResponse.json({ success: true });
    }

    // 💥 ৫. লাইক/ডিসলাইক/ভিউ কাউন্ট আপডেট করা 💥
    if (action === "REACTION") {
      const updateDoc: any = {};
      if (reactionType === "view") updateDoc.views = 1;
      if (reactionType === "like") updateDoc.likes = 1;
      if (reactionType === "dislike") updateDoc.dislikes = 1;
      if (reactionType === "unlike") updateDoc.likes = -1;
      if (reactionType === "undislike") updateDoc.dislikes = -1;

      await Notification.findByIdAndUpdate(id, { $inc: updateDoc });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}