import mongoose, { Schema, models } from "mongoose";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true }, 
    telegram: { type: String, required: true },
    country: { type: String, required: true },
    
    agentEmail: { type: String, required: true, index: true }, 
    password: { type: String, required: true },
    
    withdrawPin: { type: String, default: "1234" },
    zxId: { type: String, default: "", index: true },
    
    role: { type: String, default: "user" }, 
    status: { type: String, default: "pending", index: true }, 
    
    balance: { type: Number, default: 0 }, 
    otpRate: { type: Number, default: 0 }, 

    agentEarning: { type: Number, default: 0 }, 
    agentMaxRate: { type: Number, default: 0 }, 

    customAgentMail: { type: String, default: "" }, 
    telegramLink: { type: String, default: "" },    
    agentMaxUsers: { type: Number, default: 100 },  

    apiKey: { type: String, default: "" }, 
    isApiActive: { type: Boolean, default: false }, 

    // 💥 NEW: Admin Controlled API Permission for Agents 💥
    canManageApi: { type: Boolean, default: false },

    activeSessions: { type: [String], default: [] },
    
    // 💥 THE BOSS FIX: ACCURATE LOGIN TRACKER 💥
    lastLogin: { type: Date, default: null },

    isAutoWithdraw: { type: Boolean, default: false }, 
    binancePayId: { type: String, default: "" },       
  },
  { timestamps: true }
);

const User = models.User || mongoose.model("User", userSchema);
export default User;