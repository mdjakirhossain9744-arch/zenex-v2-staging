import mongoose, { Schema, models } from "mongoose";

const orderSchema = new Schema(
  {
    userEmail: { type: String, required: true },
    
    // 💥 ZERO-LOAD CONSOLE TRACKERS 💥
    userName: { type: String, default: "User" },
    userUid: { type: String, default: "N/A" },
    agentEmail: { type: String, default: "admin" },
    // 💥 END TRACKERS 💥

    searchNumber: { type: String, required: true },
    displayNumber: { type: String, required: true },
    country: { type: String, default: "Unknown" },
    operator: { type: String, default: "Any" },
    status: { type: String, default: "WAIT" },
    otp: { type: String, default: "Waiting..." },
    fullMessage: { type: String, default: "" },
    dateString: { type: String, required: true },
    
    // 💥 STATIC RATE FIX 💥
    orderCost: { type: Number, default: 0 }, 
    orderCommission: { type: Number, default: 0 }, 

    // 💥 ENTERPRISE GLITCH LOCK (The Ultimate Glitch Preventer) 💥
    // আগে receivedNids ছিল, এখন processedKeys ব্যবহার করা হচ্ছে যাতে NID এবং Timestamp দুটোই ট্র্যাক করা যায়
    processedKeys: { type: [String], default: [] },
    receivedNids: { type: [String], default: [] }, // আগের লকের জন্য এটা রেখে দিলাম যাতে কোনো এরর না আসে

    // 💥 ২ দিন (৪৮ ঘণ্টা) গ্যারান্টি 💥
    expireAt: { type: Date, required: true, default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } 
  },
  { timestamps: true }
);

orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Order = models.Order || mongoose.model("Order", orderSchema);
export default Order;