// models/Order.ts
import mongoose, { Schema, models } from "mongoose";

const orderSchema = new Schema(
  {
    userEmail: { type: String, required: true }, // কার নাম্বার
    searchNumber: { type: String, required: true }, // যেমন: 2327634...
    displayNumber: { type: String, required: true }, // যেমন: +2327634...
    country: { type: String, default: "Unknown" },
    operator: { type: String, default: "Any" },
    status: { type: String, default: "WAIT" }, // WAIT, DONE, FAIL
    otp: { type: String, default: "Waiting for SMS..." },
    fullMessage: { type: String, default: "" },
    dateString: { type: String, required: true }, // আজকের তারিখ
  },
  { timestamps: true }
);

// 💥 Auto-Cleanup Magic (TTL Index) 💥
// ১০ দিন পর (10 * 24 * 60 * 60 = 864000 সেকেন্ড) ডাটাবেস একা একাই এই নাম্বার/অর্ডারটি ডিলিট করে দেবে!
orderSchema.index({ createdAt: 1 }, { expireAfterSeconds: 864000 });

const Order = models.Order || mongoose.model("Order", orderSchema);
export default Order;