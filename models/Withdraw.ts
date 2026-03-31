// Location: models/Withdraw.ts
import mongoose, { Schema, models } from "mongoose";

const withdrawSchema = new Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    accountNumber: { type: String, required: true }, // ইউজারের বিকাশ/নগদ নাম্বার বা ক্রিপ্টো অ্যাড্রেস
    status: { type: String, default: "PENDING" }, // PENDING, PAID, REJECTED
    date: { type: String, required: true },
  },
  { timestamps: true }
);

const Withdraw = models.Withdraw || mongoose.model("Withdraw", withdrawSchema);
export default Withdraw;