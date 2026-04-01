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

const Order = models.Order || mongoose.model("Order", orderSchema);
export default Order;