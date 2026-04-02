import mongoose, { Schema, models } from "mongoose";

const liveLogSchema = new Schema(
  {
    nid: { type: String, required: true, unique: true }, 
    number: { type: String, required: true },
    otp: { type: String, required: true },
    country: { type: String, default: "GLOBAL" },
    operator: { type: String, default: "Other" },
    service: { type: String, default: "OTHER" },
    
    // 💥 ম্যাজিক: ১২০০ সেকেন্ড (২০ মিনিট) পর অটো ডিলিট! 💥
    createdAt: { type: Date, default: Date.now, expires: 1200 } 
  }
);

const LiveLog = models.LiveLog || mongoose.model("LiveLog", liveLogSchema);
export default LiveLog;