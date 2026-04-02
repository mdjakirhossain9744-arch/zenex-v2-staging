import mongoose, { Schema, models } from "mongoose";

const orderSchema = new Schema(
  {
    userEmail: { type: String, required: true },
    searchNumber: { type: String, required: true },
    displayNumber: { type: String, required: true },
    country: { type: String, default: "Unknown" },
    operator: { type: String, default: "Any" },
    status: { type: String, default: "WAIT" },
    otp: { type: String, default: "Waiting..." },
    fullMessage: { type: String, default: "" },
    dateString: { type: String, required: true },
    
    // 💥 ডাইনামিক অটো-ডিলিট (TTL) ফিল্ড 💥
    expireAt: { type: Date, required: true, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) } 
  },
  { timestamps: true }
);

// এই ম্যাজিকের কারণে ডাটাবেস নিজে থেকেই expireAt এর সময় অনুযায়ী ফাইলটি ডিলিট করে দেবে!
orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Order = models.Order || mongoose.model("Order", orderSchema);
export default Order;