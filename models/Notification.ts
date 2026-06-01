// Location: models/Notification.ts
import mongoose, { Schema, models } from "mongoose";

const notificationSchema = new Schema(
  {
    // 💥 INDEX ADDED: গ্লোবাল নাকি পার্সোনাল সেটা দ্রুত ফিল্টার করার জন্য 💥
    userEmail: { type: String, default: "global", index: true }, 
    noticeType: { type: String, default: "GLOBAL", index: true }, 
    title: { type: String, required: true },
    description: { type: String, required: true },
    type: { type: String, default: "INFO" }, 
    color: { type: String, default: "blue" },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    dislikes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// 💥 MASTER INDEX: ইউজারের নোটিফিকেশনগুলো লেটেস্ট (নতুনগুলো আগে) হিসেবে দ্রুত দেখানোর জন্য 💥
notificationSchema.index({ userEmail: 1, createdAt: -1 });

const Notification = models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;