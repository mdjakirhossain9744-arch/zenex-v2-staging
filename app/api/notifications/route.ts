// app/api/notifications/route.ts
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
    const { action, id, title, description, type, color, reactionType } = body;
    
    const role = getUserRole(req);

    // 💥 ১. সবার জন্য নোটিশ ফেচ করা 💥
    if (action === "FETCH") {
      const notifs = await Notification.find().sort({ createdAt: -1 });
      return NextResponse.json({ success: true, data: notifs });
    }

    // 💥 ২. এডমিনের জন্য নোটিশ তৈরি করা 💥
    if (action === "CREATE") {
      if (role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
      const newNotif = new Notification({ title, description, type, color });
      await newNotif.save();
      return NextResponse.json({ success: true });
    }

    // 💥 ৩. এডমিনের জন্য নোটিশ ডিলিট করা 💥
    if (action === "DELETE") {
      if (role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
      await Notification.findByIdAndDelete(id);
      return NextResponse.json({ success: true });
    }

    // 💥 ৪. লাইক/ডিসলাইক/ভিউ কাউন্ট আপডেট করা (Atomic Operation) 💥
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