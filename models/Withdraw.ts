// Location: models/Withdraw.ts
import mongoose, { Schema, models } from "mongoose";

const withdrawSchema = new Schema(
  {
    email: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    accountNumber: { type: String, required: true }, 
    status: { type: String, default: "PENDING" }, // PENDING, PROCESSING, PAID, REJECTED
    date: { type: String, required: true },
    wid: { type: String, default: "" }, // Added for Transaction/Ref ID
    adminNote: { type: String, default: "" }, // Added for TX Hash or Action Note
  },
  { timestamps: true }
);

const Withdraw = models.Withdraw || mongoose.model("Withdraw", withdrawSchema);
export default Withdraw;