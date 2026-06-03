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

    // 🔥 FIX 1: Strictly check against customAgentMail ONLY (Personal email blocked) 🔥
    const validAgent = await User.findOne({ 
      customAgentMail: agentEmail,
      role: "agent" 
    });

    if (!validAgent) {
      return NextResponse.json({ message: "Invalid Agent Email! Please strictly use the official Agent Mail (e.g., @zenexnetwork.com)." }, { status: 400 });
    }

    // এখন থেকে শুধুমাত্র "active" স্ট্যাটাসের ইউজাররা সিট কাউন্ট করবে, "pending" কাউন্ট করবে না।
    const totalAgentUsers = await User.countDocuments({
      agentEmail: validAgent.customAgentMail, // 🔥 Updated to match strictly
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
      withdrawPin: finalPin, 
      role: "user", 
      status: "pending", 
      balance: 0, 
      otpRate: 0, 
      apiKey: newApiKey,       
      isApiActive: false,      
    });

    // 💥 ম্যাজিক: মঙ্গোডিবির অরিজিনাল আইডি থেকেই ZX-ID বানিয়ে ডাটাবেসে সেভ করে দেওয়া হচ্ছে 💥
    newUser.zxId = `ZX-${newUser._id.toString().slice(-6).toUpperCase()}`;

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