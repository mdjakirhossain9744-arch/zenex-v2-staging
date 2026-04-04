import mongoose, { Schema, models } from "mongoose";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    telegram: { type: String, required: true },
    country: { type: String, required: true },
    agentEmail: { type: String, required: true }, 
    password: { type: String, required: true },
    
    // 💥 ম্যাজিক: উইথড্র সিকিউরিটি পিন (ডিফল্ট 1234) 💥
    withdrawPin: { type: String, default: "1234" },
    
    role: { type: String, default: "user" }, 
    status: { type: String, default: "pending" }, 
    
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
  },
  { timestamps: true }
);

const User = models.User || mongoose.model("User", userSchema);
export default User;