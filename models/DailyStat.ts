import mongoose, { Schema, models } from "mongoose";

const dailyStatSchema = new Schema(
  {
    dateString: { type: String, required: true }, // কোন তারিখের ডাটা (যেমন: 2026-04-03)
    userEmail: { type: String, required: true }, // কার ডাটা
    agentEmail: { type: String, default: "admin" }, // কোন এজেন্টের আন্ডারে
    
    totalNumbers: { type: Number, default: 0 }, // মোট কতটি নাম্বার নিয়েছিল
    successOTP: { type: Number, default: 0 }, // কয়টি সাকসেস হয়েছে
    failedNumbers: { type: Number, default: 0 }, // কয়টি ফেইল হয়েছে
    
    totalCost: { type: Number, default: 0 }, // অ্যাডমিনের মোট খরচ (Total Payout)
  },
  { timestamps: true }
);

// একই ইউজার এবং তারিখের যেন ডাবল ডাটা তৈরি না হয়, তার জন্য সিকিউরিটি
dailyStatSchema.index({ dateString: 1, userEmail: 1 }, { unique: true });

const DailyStat = models.DailyStat || mongoose.model("DailyStat", dailyStatSchema);
export default DailyStat;