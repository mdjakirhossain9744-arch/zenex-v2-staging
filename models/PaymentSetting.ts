// Location: models/PaymentSetting.ts
import mongoose, { Schema, models } from "mongoose";

const paymentSettingSchema = new Schema(
  {
    type: { type: String, default: "global" },
    
    // 💥 ৩ স্তরের সিকিউরিটি গেইট 💥
    isWithdrawOpen: { type: Boolean, default: true },       // 1. Global Master Switch
    isManualWithdrawOpen: { type: Boolean, default: true }, // 2. NEW: Manual Gate (bKash, Nagad etc)
    binanceAutoPayActive: { type: Boolean, default: true }, // 3. Auto-Pay Engine (Binance)
    
    methods: {
      bKash: { type: Boolean, default: true },
      Nagad: { type: Boolean, default: true },
      Rocket: { type: Boolean, default: true },
      Binance: { type: Boolean, default: true },
      TRC20: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

const PaymentSetting = models.PaymentSetting || mongoose.model("PaymentSetting", paymentSettingSchema);
export default PaymentSetting;