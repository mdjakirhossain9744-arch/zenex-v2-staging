import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order"; 

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function GET(req: Request) {
    try {
        await connectToDatabase();
        
        const { searchParams } = new URL(req.url);
        const number = searchParams.get("number");

        if (!number) {
            return NextResponse.json({ 
                success: false, 
                message: "Please provide a number parameter. Example: /api/check-raw?number=123456" 
            });
        }

        const cleanNumber = String(number).replace(/\D/g, "");

        // ১. ডাটাবেস থেকে নাম্বারটির লেটেস্ট ইউজারকে (Email) খুঁজে বের করা
        const latestOrder = await Order.findOne({ 
            searchNumber: new RegExp(cleanNumber + "$") 
        }).sort({ createdAt: -1 }).select("userEmail status createdAt").lean();

        const assignedEmail = latestOrder ? latestOrder.userEmail : "Unknown / Not found in DB";
        const orderStatus = latestOrder ? latestOrder.status : "N/A";
        const orderTime = latestOrder ? new Date(latestOrder.createdAt).toLocaleString() : "N/A";

        const RawLog = mongoose.models.mnit_raw_logs || mongoose.model("mnit_raw_logs", new mongoose.Schema({
            timestamp: { type: Date, default: Date.now }, 
            rawPayload: { type: mongoose.Schema.Types.Mixed } 
        }, { strict: false }));

        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

        // 💥 দ্য বস ফিক্স: Native MongoDB Query (Bypass Mongoose Type Restrictions) 💥
        // এর ফলে অ্যারের যতো ভেতরেই নাম্বার থাকুক না কেন, ডাটাবেস ১০০% খুঁজে বের করবে।
        const recentLogs = await RawLog.collection.find({
            timestamp: { $gte: twoHoursAgo },
            "rawPayload.providerData.number": { $regex: cleanNumber + "$", $options: "i" }
        }).sort({ timestamp: -1 }).toArray();

        let matchedOtps: any[] = [];
        let totalHitsDetected = 0;
        let uniqueIds = new Set(); 

        // ৩. ডাটা ফিল্টার করে ডুপ্লিকেট বাদ দেওয়া
        recentLogs.forEach((log: any) => {
            if (log.rawPayload && Array.isArray(log.rawPayload.providerData)) {
                const filtered = log.rawPayload.providerData.filter((item: any) => 
                    String(item.number || "").replace(/\D/g, "").endsWith(cleanNumber)
                );
                
                filtered.forEach((item: any) => {
                    const otpId = item.otp_id;
                    if (!uniqueIds.has(otpId)) {
                        uniqueIds.add(otpId);
                        matchedOtps.push(item);
                        totalHitsDetected++;
                    }
                });
            }
        });

        if (totalHitsDetected === 0) {
            return NextResponse.json({
                success: true,
                targetNumber: cleanNumber,
                assignedUserEmail: assignedEmail,
                currentOrderStatus: orderStatus,
                message: "No raw data found from Provider for this specific number in the last 2 hours."
            });
        }

        // ৪. ইউজারের ইমেইল এবং শেষ ২ ঘণ্টার Raw Data একসাথে রিটার্ন করা
        return NextResponse.json({
            success: true,
            targetNumber: cleanNumber,
            assignedUserEmail: assignedEmail, 
            currentOrderStatus: orderStatus, 
            orderCreatedAt: orderTime,
            totalHitsDetected,
            message: "Filtered EXACT RAW DATA for this specific number from the last 2 hours.",
            logs: matchedOtps
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}