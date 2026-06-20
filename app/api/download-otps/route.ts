import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";

// 💥 NEXT.JS CORE CACHE KILLER 💥
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export async function POST(req: Request) {
    try {
        await connectToDatabase();
        const body = await req.json().catch(() => ({}));
        const { email, targetDate } = body;

        if (!email || !targetDate) {
            return NextResponse.json({ success: false, message: "Missing params" }, { status: 400 });
        }

        // 🔥 HIGH-PERFORMANCE ZERO-LOAD ENGINE: Projection ($project)
        // Only fetch exactly what is needed (Number and OTP/Message) to keep RAM usage ~0MB.
        const orders = await Order.find({ 
            userEmail: email, 
            dateString: targetDate, 
            status: "DONE" 
        }).select("displayNumber searchNumber otp fullMessage -_id").lean();

        if (!orders || orders.length === 0) {
            return NextResponse.json({ success: true, textData: "" });
        }

        let textData = "";
        
        for (let i = 0; i < orders.length; i++) {
            const item: any = orders[i];
            // Get pure digits without + or spaces
            const num = String(item.displayNumber || item.searchNumber).replace(/\D/g, '');
            
            // 💥 Handle Multi-Message (_||_) logic accurately 💥
            if (item.fullMessage && item.fullMessage.includes("_||_")) {
                const msgsArray = item.fullMessage.split("_||_");
                for (let j = 0; j < msgsArray.length; j++) {
                    const msg = msgsArray[j].trim();
                    if (msg) {
                        const match = msg.match(/(?:\b\d{4,8}\b)|(?:\b\d{3}[\s-]\d{3,4}\b)|(?:G-\d{6,8})/i);
                        const finalOtp = match ? match[0].replace(/[\s-]+/g, '') : String(item.otp || "").replace(/[\s-]+/g, '');
                        textData += `${num}|${finalOtp}\n`;
                    }
                }
            } else {
                // Handle Single Message
                const msg = item.fullMessage || item.otp || "";
                const match = String(msg).match(/(?:\b\d{4,8}\b)|(?:\b\d{3}[\s-]\d{3,4}\b)|(?:G-\d{6,8})/i);
                const finalOtp = match ? match[0].replace(/[\s-]+/g, '') : String(item.otp || "").replace(/[\s-]+/g, '');
                textData += `${num}|${finalOtp}\n`;
            }
        }

        // Send ready-to-download plain text buffer straight to Frontend
        return NextResponse.json({ success: true, textData });

    } catch (error) {
        console.error("Bulk Download Error:", error);
        return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
    }
}