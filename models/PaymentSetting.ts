// Location: models/PaymentSetting.ts
import mongoose, { Schema, models } from "mongoose";

const paymentSettingSchema = new Schema(
  {
    // 💥 INDEX ADDED: গ্লোবাল সেটিং দ্রুত ফেচ করার জন্য 💥
    type: { type: String, default: "global", index: true },
    
    // 💥 ৩ স্তরের সিকিউরিটি গেইট 💥
    isWithdrawOpen: { type: Boolean, default: true },       
    isManualWithdrawOpen: { type: Boolean, default: true }, 
    binanceAutoPayActive: { type: Boolean, default: true }, 
    
    // 💥 NEW: ADMIN AUTO-APPROVE BOT (আপনার মূল মিসিং লজিকটি) 💥
    isAutoApproveBotActive: { type: Boolean, default: false },
    
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