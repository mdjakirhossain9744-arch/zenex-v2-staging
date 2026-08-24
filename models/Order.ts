import mongoose, { Schema, models } from "mongoose";

const orderSchema = new Schema(
  {
    userEmail: { type: String, required: true, index: true },
    
    // ZERO-LOAD CONSOLE TRACKERS 
    userName: { type: String, default: "User" },
    userUid: { type: String, default: "N/A" },
    agentEmail: { type: String, default: "admin" },

    searchNumber: { type: String, required: true, index: true },
    displayNumber: { type: String, required: true },
    
    // 💥 BUG FIXED: Removed inline `index: true` to prevent Duplicate Index Warning
    trxId: { type: String }, 
    requestedRange: { type: String }, 
    trueService: { type: String, default: "Unknown" }, 

    country: { type: String, default: "Unknown" },
    operator: { type: String, default: "Any" },
    
    status: { type: String, default: "WAIT", index: true },
    otp: { type: String, default: "Waiting..." },
    fullMessage: { type: String, default: "" },
    
    dateString: { type: String, required: true, index: true },
    
    // STATIC RATE FIX 
    orderCost: { type: Number, default: 0 }, 
    orderCommission: { type: Number, default: 0 }, 

    // ENTERPRISE GLITCH LOCK 
    processedKeys: { type: [String], default: [] },
    receivedNids: { type: [String], default: [] }, 

    // ২ দিন (৪৮ ঘণ্টা) গ্যারান্টি
    expireAt: { type: Date, required: true, default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } 
  },
  { timestamps: true }
);

// 💥 THE MASTER ARCHITECT TRICK: Compound Indexing 💥
orderSchema.index({ userEmail: 1, dateString: 1 });
orderSchema.index({ searchNumber: 1, status: 1 });
// 💥 Single definitive index for Webhook Lookup
orderSchema.index({ trxId: 1 }); 

// 💥 The Ultimate Dashboard Covering Index! 
orderSchema.index({ userEmail: 1, dateString: 1, status: 1 });
// 💥 For API Microservice Fast Lookup
orderSchema.index({ userEmail: 1, status: 1, updatedAt: -1 });

// TTL Index for Auto Delete
orderSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const Order = models.Order || mongoose.model("Order", orderSchema);
export default Order;