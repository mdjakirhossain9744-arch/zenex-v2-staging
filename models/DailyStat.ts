import mongoose, { Schema, models } from "mongoose";

const dailyStatSchema = new Schema(
  {
    dateString: { type: String, required: true }, 
    userEmail: { type: String, required: true }, 
    
    // 💥 INDEX ADDED: ম্যানেজার/এজেন্ট যখন তার মেম্বারদের ইনকাম দেখবে, তখন যেন সার্ভার ফাস্ট থাকে 💥
    agentEmail: { type: String, default: "admin", index: true }, 
    
    totalNumbers: { type: Number, default: 0 }, 
    successOTP: { type: Number, default: 0 }, 
    failedNumbers: { type: Number, default: 0 }, 
    
    // 💥 STATIC RATE FIX 💥
    totalCost: { type: Number, default: 0 }, 
    totalCommission: { type: Number, default: 0 }, 
  },
  { timestamps: true }
);

// 💥 Existing Unique Index (Perfect!) 💥
dailyStatSchema.index({ dateString: 1, userEmail: 1 }, { unique: true });

const DailyStat = models.DailyStat || mongoose.model("DailyStat", dailyStatSchema);
export default DailyStat;