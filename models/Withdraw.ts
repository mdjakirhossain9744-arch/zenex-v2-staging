import mongoose, { Schema, models } from "mongoose";

const withdrawSchema = new Schema(
  {
    // 💥 INDEX ADDED: ইউজার তার নিজের উইথড্র হিস্ট্রি দেখার জন্য 💥
    email: { type: String, required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    accountNumber: { type: String, required: true }, 
    
    // 💥 INDEX ADDED: এডমিন প্যানেলে 'PENDING' বা 'SUCCESS' উইথড্র দ্রুত লোড হওয়ার জন্য 💥
    status: { type: String, default: "PENDING", index: true }, 
    date: { type: String, required: true },
    
    // 💥 INDEX ADDED: ট্রানজেকশন আইডি (WID) দিয়ে দ্রুত সার্চ করার জন্য 💥
    wid: { 
        type: String, 
        default: () => "ZX-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        index: true
    }, 
    adminNote: { 
        type: String, 
        default: "Processing request..." 
    },
  },
  { timestamps: true }
);

// 💥 MASTER INDEX: এডমিন এবং ইউজারের জন্য লেটেস্ট উইথড্র দ্রুত বের করার ট্রিক 💥
withdrawSchema.index({ email: 1, createdAt: -1 });
withdrawSchema.index({ status: 1, createdAt: -1 });

const Withdraw = models.Withdraw || mongoose.model("Withdraw", withdrawSchema);
export default Withdraw;