import mongoose, { Schema, models } from "mongoose";

const liveLogSchema = new Schema(
  {
    nid: { type: String, required: true, unique: true }, // MNIT এর ইউনিক আইডি (ডুপ্লিকেট হবে না)
    number: { type: String, required: true },
    otp: { type: String, required: true },
    country: { type: String, default: "GLOBAL" },
    operator: { type: String, default: "Other" },
    service: { type: String, default: "OTHER" }, // Facebook, Whatsapp etc.
    
    // 💥 ম্যাজিক: MongoDB TTL Index (২৪ ঘণ্টা পর অটোমেটিক ডিলিট হয়ে যাবে) 💥
    createdAt: { type: Date, default: Date.now, expires: 86400 } 
  }
);

const LiveLog = models.LiveLog || mongoose.model("LiveLog", liveLogSchema);
export default LiveLog;