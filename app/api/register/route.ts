import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Notification from "../../../models/Notification"; // 💥 নোটিফিকেশন ইমপোর্ট

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
      $or: [{ customAgentMail: agentEmail }, { email: agentEmail }],
      role: "agent" 
    });

    if (!validAgent) {
      return NextResponse.json({ message: "Invalid Agent Email! Please contact an authorized agent." }, { status: 400 });
    }

    const totalAgentUsers = await User.countDocuments({
      $or: [
        { agentEmail: validAgent.email }, 
        { agentEmail: validAgent.customAgentMail }
      ],
      role: "user"
    });

    const maxLimit = validAgent.agentMaxUsers || 100;
    
    if (totalAgentUsers >= maxLimit) {
      return NextResponse.json({ 
        message: `দুঃখিত! এই এজেন্টের সিট ফুল হয়ে গেছে (${maxLimit}/${maxLimit})। নতুন কেউ জয়েন করতে পারবে না।` 
      }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newApiKey = generateApiKey();
    
    // 💥 ইউজার যদি পিন না দেয়, তবে ডিফল্ট 1234 সেট হবে
    const finalPin = withdrawPin && withdrawPin.trim() !== "" ? withdrawPin : "1234";

    const newUser = new User({
      fullName, 
      mobile, 
      email, 
      telegram, 
      country, 
      agentEmail: agentEmail, 
      password: hashedPassword,
      withdrawPin: finalPin, // 💥 পিন সেভ করা হলো
      role: "user", 
      status: "pending", 
      balance: 0, 
      otpRate: 0, // 💥 মাস্টার রুলস: নতুন ইউজারের রেট 0 থাকবে 💥
      apiKey: newApiKey,       
      isApiActive: false,      
    });

    await newUser.save();

    // 🔔 💥 ওয়েলকাম নোটিফিকেশন পাঠানো হলো 💥 🔔
    await Notification.create({
      userEmail: email,
      title: "Welcome to ZENEX NETWORK 🎉",
      description: `Hello ${fullName}, your account has been successfully created. Please wait for your Agent's approval to start working. Your default Withdraw PIN is 1234.`,
      type: "INFO",
      color: "blue"
    });

    return NextResponse.json({ message: "Account Created Successfully! Waiting for Agent approval." }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}