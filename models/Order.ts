import mongoose, { Schema, models } from "mongoose";

const orderSchema = new Schema(
  {
    // 💥 INDEX ADDED: ইউজারের ইমেইল দিয়ে ফাস্ট সার্চ করার জন্য 💥
    userEmail: { type: String, required: true, index: true },
    
    // 💥 ZERO-LOAD CONSOLE TRACKERS 💥
    userName: { type: String, default: "User" },
    userUid: { type: String, default: "N/A" },
    agentEmail: { type: String, default: "admin" },
    // 💥 END TRACKERS 💥

    // 💥 INDEX ADDED: OTP আসার পর নাম্বার দিয়ে খোঁজার জন্য 💥
    searchNumber: { type: String, required: true, index: true },
    displayNumber: { type: String, required: true },
    country: { type: String, default: "Unknown" },
    operator: { type: String, default: "Any" },
    
    // 💥 INDEX ADDED: WAIT, DONE স্ট্যাটাস ফিল্টার করার জন্য 💥
    status: { type: String, default: "WAIT", index: true },
    otp: { type: String, default: "Waiting..." },
    fullMessage: { type: String, default: "" },
    
    // 💥 INDEX ADDED: আজকের ডাটা ফিল্টার করার জন্য 💥
    dateString: { type: String, required: true, index: true },
    
    // 💥 STATIC RATE FIX 💥
    orderCost: { type: Number, default: 0 }, 
    orderCommission: { type: Number, default: 0 }, 

    // 💥 ENTERPRISE GLITCH LOCK (The Ultimate Glitch Preventer) 💥
    processedKeys: { type: [String], default: [] },
    receivedNids: { type: [String], default: [] }, 

    // 💥 ২ দিন (৪৮ ঘণ্টা) গ্যারান্টি 💥
    expireAt: { type: Date, required: true, default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } 
  },
  { timestamps: true }
);

// 💥 THE MASTER ARCHITECT TRICK: Compound Indexing 💥
// (ইউজার যখন ড্যাশবোর্ডে থাকে, তখন ইমেইল আর ডেট দিয়ে একসাথে সার্চ হয়, এটা সেই স্পিড ১০০ গুণ বাড়াবে)
orderSchema.index({ userEmail: 1, dateString: 1 });
orderSchema.index({ searchNumber: 1, status: 1 });

// TTL Index for Auto Delete
orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Order = models.Order || mongoose.model("Order", orderSchema);
export default Order;