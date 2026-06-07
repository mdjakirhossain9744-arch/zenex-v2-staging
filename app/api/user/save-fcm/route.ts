import { NextResponse } from "next/server";
import mongoose from "mongoose";
import User from "@/models/User"; // আপনার User মডেলের পাথ

export async function POST(req: Request) {
    try {
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI as string);
        }

        const { email, fcmToken } = await req.json();

        if (!email || !fcmToken) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        // Token ডেটাবেসে সেভ/আপডেট করা
        await User.findOneAndUpdate(
            { email: email },
            { $set: { fcmToken: fcmToken } }
        );

        return NextResponse.json({ success: true, message: "Token Saved Successfully!" });
    } catch (error) {
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}