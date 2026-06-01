import mongoose, { Schema, models } from "mongoose";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // unique: true এমনিতেই ইনডেক্স তৈরি করে
    telegram: { type: String, required: true },
    country: { type: String, required: true },
    
    // 💥 INDEX ADDED: এডমিন/ম্যানেজার তার ইউজারদের দ্রুত দেখার জন্য 💥
    agentEmail: { type: String, required: true, index: true }, 
    password: { type: String, required: true },
    
    // 💥 ম্যাজিক: উইথড্র সিকিউরিটি পিন (ডিফল্ট 1234) 💥
    withdrawPin: { type: String, default: "1234" },
    
    // 💥 INDEX ADDED: ইউজার আইডি (ZX-ID) দিয়ে সার্চ করার জন্য 💥
    zxId: { type: String, default: "", index: true },
    
    role: { type: String, default: "user" }, 
    
    // 💥 INDEX ADDED: Active/Pending/Banned ইউজার দ্রুত ফিল্টার করার জন্য 💥
    status: { type: String, default: "pending", index: true }, 
    
    balance: { type: Number, default: 0 }, 
    otpRate: { type: Number, default: 0 }, // 💥 Magic Fix: Default rate is 0.00

    agentEarning: { type: Number, default: 0 }, 
    agentMaxRate: { type: Number, default: 0 }, 

    customAgentMail: { type: String, default: "" }, 
    telegramLink: { type: String, default: "" },    
    agentMaxUsers: { type: Number, default: 100 },  

    apiKey: { type: String, default: "" }, 
    isApiActive: { type: Boolean, default: false }, 

    activeSessions: { type: [String], default: [] },

    // 💥 NEW: Binance Auto-Withdraw Fields 💥
    isAutoWithdraw: { type: Boolean, default: false }, 
    binancePayId: { type: String, default: "" },       
  },
  { timestamps: true }
);

const User = models.User || mongoose.model("User", userSchema);
export default User;