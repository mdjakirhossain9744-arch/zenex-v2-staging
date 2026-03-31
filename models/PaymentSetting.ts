// Location: models/PaymentSetting.ts
import mongoose, { Schema, models } from "mongoose";

const paymentSettingSchema = new Schema({
  type: { type: String, default: "global" },
  isWithdrawOpen: { type: Boolean, default: true },
  methods: {
    bKash: { type: Boolean, default: true },
    Nagad: { type: Boolean, default: true },
    Rocket: { type: Boolean, default: true },
    Binance: { type: Boolean, default: true },
    TRC20: { type: Boolean, default: true }
  }
});

const PaymentSetting = models.PaymentSetting || mongoose.model("PaymentSetting", paymentSettingSchema);
export default PaymentSetting;