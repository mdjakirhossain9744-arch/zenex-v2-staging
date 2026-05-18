import mongoose, { Schema, models } from "mongoose";

const dailyStatSchema = new Schema(
  {
    dateString: { type: String, required: true }, 
    userEmail: { type: String, required: true }, 
    agentEmail: { type: String, default: "admin" }, 
    
    totalNumbers: { type: Number, default: 0 }, 
    successOTP: { type: Number, default: 0 }, 
    failedNumbers: { type: Number, default: 0 }, 
    
    // 💥 STATIC RATE FIX 💥
    totalCost: { type: Number, default: 0 }, 
    totalCommission: { type: Number, default: 0 }, 
  },
  { timestamps: true }
);

dailyStatSchema.index({ dateString: 1, userEmail: 1 }, { unique: true });

const DailyStat = models.DailyStat || mongoose.model("DailyStat", dailyStatSchema);
export default DailyStat;