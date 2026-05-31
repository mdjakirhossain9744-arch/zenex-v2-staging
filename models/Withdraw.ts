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
    
    // Transaction ID and Notes
    wid: { type: String, default: "" }, 
    adminNote: { type: String, default: "" },
  },
  { timestamps: true }
);

const Withdraw = models.Withdraw || mongoose.model("Withdraw", withdrawSchema);
export default Withdraw;