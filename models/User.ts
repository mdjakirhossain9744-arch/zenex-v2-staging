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
    
    role: { type: String, default: "user" }, 
    status: { type: String, default: "pending" }, 
    
    balance: { type: Number, default: 0 }, 
    otpRate: { type: Number, default: 0.50 }, // মেম্বারের রেট

    agentEarning: { type: Number, default: 0 }, 
    agentMaxRate: { type: Number, default: 0.70 }, // এডমিন এজেন্টকে যে রেট দিবে

    customAgentMail: { type: String, default: "" }, 
    telegramLink: { type: String, default: "" },    
    agentMaxUsers: { type: Number, default: 100 },  
  },
  { timestamps: true }
);

const User = models.User || mongoose.model("User", userSchema);
export default User;