import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 

// 💥 সিক্রেট কী (এটি দিয়ে টোকেন লক করা হবে)
const JWT_SECRET = process.env.JWT_SECRET || "ZENEX_SUPER_SECRET_KEY_2024";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { emailOrPhone, password } = body;

    await connectToDatabase();

    const user = await User.findOne({
      $or: [{ email: emailOrPhone }, { mobile: emailOrPhone }]
    });

    if (!user) {
      return NextResponse.json({ message: "এই ইমেইল বা নাম্বার দিয়ে কোনো একাউন্ট নেই!" }, { status: 404 });
    }

    if (user.status === "pending") {
      return NextResponse.json({ message: "Your account is pending! Waiting for Agent approval." }, { status: 403 });
    }
    if (user.status === "banned") {
      return NextResponse.json({ message: "Your account is banned! Contact Support." }, { status: 403 });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return NextResponse.json({ message: "আপনার পাসওয়ার্ড ভুল হয়েছে!" }, { status: 401 });
    }

    let agentTelegram = "https://t.me/zenex_official_support";
    let agentName = "Zenex Admin";

    if (user.agentEmail && user.role === "user" && user.agentEmail !== "admin@zenexnetwork.com") {
       const agentInfo = await User.findOne({ email: user.agentEmail, role: "agent" });
       if (agentInfo) {
          agentTelegram = agentInfo.telegram.startsWith("@") ? `https://t.me/${agentInfo.telegram.replace("@", "")}` : agentInfo.telegram;
          agentName = agentInfo.fullName;
       }
    }

    // 💥 ১. JWT টোকেন তৈরি (১২ ঘণ্টার মেয়াদ) 💥
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    const response = NextResponse.json({ 
      message: "Login Successful!",
      user: {
        id: user._id,
        name: user.fullName,
        email: user.email,
        mobile: user.mobile,
        telegram: user.telegram,
        country: user.country,
        role: user.role, 
        status: user.status,
        balance: user.balance || 0,
        agentEmail: user.agentEmail,
        agentName: agentName,
        agentContactLink: agentTelegram
      }
    }, { status: 200 });

    // 💥 ২. HTTP-Only Cookie সেট করা হচ্ছে (হ্যাকাররা ধরতে পারবে না) 💥
    response.cookies.set("zenex_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 12 * 60 * 60, // 12 ঘণ্টা
      path: "/",
    });

    return response;

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}