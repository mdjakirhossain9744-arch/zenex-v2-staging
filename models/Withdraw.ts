import mongoose, { Schema, models } from "mongoose";

const withdrawSchema = new Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    accountNumber: { type: String, required: true }, 
    status: { type: String, default: "PENDING" }, 
    date: { type: String, required: true },
    
    // 💥 GLOBAL AUTO-GENERATOR: Works for Manual AND Auto-Pay 💥
    wid: { 
        type: String, 
        default: () => "ZX-" + Math.random().toString(36).substring(2, 8).toUpperCase() 
    }, 
    adminNote: { 
        type: String, 
        default: "Processing request..." 
    },
  },
  { timestamps: true }
);

const Withdraw = models.Withdraw || mongoose.model("Withdraw", withdrawSchema);
export default Withdraw;