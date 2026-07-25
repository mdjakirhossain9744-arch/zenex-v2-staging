import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Notification from "../../../models/Notification"; 

const generateApiKey = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let key = "ZNX_";
  for (let i = 0; i < 24; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, mobile, email, telegram, country, agentEmail, password, withdrawPin } = body;

    await connectToDatabase();

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return NextResponse.json({ message: "এই ইমেইল বা নাম্বার দিয়ে আগে থেকেই একাউন্ট আছে!" }, { status: 400 });
    }

    if (agentEmail === "admin@zenexnetwork.com" || agentEmail.toLowerCase() === "admin") {
      return NextResponse.json({ 
        message: "দুঃখিত! কোনো ভেরিফাইড এজেন্টের রেফারেন্স ছাড়া একাউন্ট খোলা নিষেধ। দয়া করে একজন এজেন্টের সাথে যোগাযোগ করুন।" 
      }, { status: 403 });
    }

    const validAgent = await User.findOne({ 
      customAgentMail: agentEmail,
      role: "agent" 
    });

    if (!validAgent) {
      return NextResponse.json({ message: "Invalid Agent Email! Please strictly use the official Agent Mail (e.g., @zenexnetwork.com)." }, { status: 400 });
    }

    const totalAgentUsers = await User.countDocuments({
      agentEmail: validAgent.customAgentMail, 
      role: "user",
      status: "active" 
    });

    const maxLimit = validAgent.agentMaxUsers || 100;
    
    if (totalAgentUsers >= maxLimit) {
      return NextResponse.json({ 
        message: `দুঃখিত! এই এজেন্টের সিট ফুল হয়ে গেছে (${maxLimit}/${maxLimit})। নতুন কেউ জয়েন করতে পারবে না।` 
      }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newApiKey = generateApiKey();
    
    const finalPin = withdrawPin && withdrawPin.trim() !== "" ? withdrawPin : "1234";

    const newUser = new User({
      fullName, 
      mobile, 
      email, 
      telegram, 
      country, 
      agentEmail: agentEmail, 
      password: hashedPassword,
      withdrawPin: finalPin, 
      role: "user", 
      status: "pending", 
      balance: 0, 
      otpRate: 0, 
      apiKey: newApiKey,       
      isApiActive: false,      
    });

    newUser.zxId = `ZX-${newUser._id.toString().slice(-6).toUpperCase()}`;

    await newUser.save();

    // 🔔 💥 THE BOSS FIX: LOGICAL & PROFESSIONAL WELCOME NOTIFICATION 💥 🔔
    await Notification.create({
      userEmail: email,
      title: "Welcome to ZENEX NETWORK 🎉",
      description: `Hello ${fullName}, your account has been successfully activated. Welcome to your dashboard! ⚠️ WARNING: Your account will be permanently suspended if you do not work regularly.`,
      type: "INFO",
      color: "blue"
    });

    return NextResponse.json({ message: "Account Created Successfully! Waiting for Agent approval." }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}