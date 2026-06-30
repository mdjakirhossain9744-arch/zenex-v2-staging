import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order"; // Order মডেল ইম্পোর্ট করা হলো ইউজারের মেইল বের করার জন্য

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

        // 💥 ১. ডাটাবেস থেকে নাম্বারটির লেটেস্ট ইউজারকে (Email) খুঁজে বের করা
        const latestOrder = await Order.findOne({ 
            searchNumber: new RegExp(cleanNumber + "$") // নাম্বারটি দিয়ে অর্ডার খোঁজা
        }).sort({ createdAt: -1 }).select("userEmail status createdAt").lean();

        const assignedEmail = latestOrder ? latestOrder.userEmail : "Unknown / Not found in DB";
        const orderStatus = latestOrder ? latestOrder.status : "N/A";
        const orderTime = latestOrder ? new Date(latestOrder.createdAt).toLocaleString() : "N/A";

        // 💥 ২. প্রোভাইডারের Raw Logs খোঁজা
        const RawLog = mongoose.models.mnit_raw_logs || mongoose.model("mnit_raw_logs", new mongoose.Schema({
            timestamp: { type: Date, default: Date.now },
            rawPayload: { type: Object }
        }, { strict: false }));

        // শেষ ১০০টি Raw Log আনবো
        const recentLogs = await RawLog.find().sort({ timestamp: -1 }).limit(100).lean();

        let matchedOtps: any[] = [];
        let totalHitsDetected = 0;
        let uniqueIds = new Set(); 

        // বস্তা (Logs) ঘেঁটে শুধু টার্গেট নাম্বারের ডাটা ফিল্টার করা
        recentLogs.forEach((log: any) => {
            if (log.rawPayload && Array.isArray(log.rawPayload.providerData)) {
                const filtered = log.rawPayload.providerData.filter((item: any) => 
                    String(item.number || "").replace(/\D/g, "") === cleanNumber
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
                message: "No raw data found from Provider for this specific number in recent logs."
            });
        }

        // 💥 ৩. ইউজারের ইমেইল এবং Raw Data একসাথে রিটার্ন করা
        return NextResponse.json({
            success: true,
            targetNumber: cleanNumber,
            assignedUserEmail: assignedEmail, // ইউজারের ইমেইল দেখাবে
            currentOrderStatus: orderStatus, // নাম্বারটার বর্তমান স্ট্যাটাস দেখাবে
            orderCreatedAt: orderTime,
            totalHitsDetected,
            message: "Filtered EXACT RAW DATA and User Assignment for this specific number.",
            logs: matchedOtps
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}