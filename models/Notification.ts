// Location: models/Notification.ts
import mongoose, { Schema, models } from "mongoose";

const notificationSchema = new Schema(
  {
    userEmail: { type: String, default: "global" }, // 💥 ম্যাজিক: 'global' হলে সবাই দেখবে, ইমেইল থাকলে শুধু সে দেখবে!
    noticeType: { type: String, default: "GLOBAL" }, // 💥 নতুন লজিক: GLOBAL অথবা PERSONAL
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, default: "INFO" }, // INFO, UPDATE, WARNING, SUCCESS
    color: { type: String, default: "blue" },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Notification = models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;