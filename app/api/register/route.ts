import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 

// 💥 শক্তিশালী API Key জেনারেটর (ZNX_ + ২৪ ক্যারেক্টারের র‍্যান্ডম কোড)
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
    const { fullName, mobile, email, telegram, country, agentEmail, password } = body;

    await connectToDatabase();

    // ১. চেক করা হচ্ছে ইমেইল বা নাম্বার আগে থেকে আছে কি না
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return NextResponse.json({ message: "এই ইমেইল বা নাম্বার দিয়ে আগে থেকেই একাউন্ট আছে!" }, { status: 400 });
    }

    // ২. এডমিনের আন্ডারে সরাসরি একাউন্ট খোলা সম্পূর্ণ বন্ধ (Security Lock)
    if (agentEmail === "admin@zenexnetwork.com" || agentEmail.toLowerCase() === "admin") {
      return NextResponse.json({ 
        message: "দুঃখিত! কোনো ভেরিফাইড এজেন্টের রেফারেন্স ছাড়া একাউন্ট খোলা নিষেধ। দয়া করে একজন এজেন্টের সাথে যোগাযোগ করুন।" 
      }, { status: 403 });
    }

    // ৩. এজেন্ট ভেরিফিকেশন এবং সিট লিমিট চেক
    const validAgent = await User.findOne({ 
      $or: [{ customAgentMail: agentEmail }, { email: agentEmail }],
      role: "agent" 
    });

    if (!validAgent) {
      return NextResponse.json({ message: "Invalid Agent Email! Please contact an authorized agent." }, { status: 400 });
    }

    // ৪. ম্যাজিক: এজেন্টের আন্ডারে বর্তমানে কতজন ইউজার আছে সেটা গোনা হচ্ছে
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
    
    // 💥 ইউজারের জন্য নতুন API Key তৈরি করা হচ্ছে 💥
    const newApiKey = generateApiKey();

    const newUser = new User({
      fullName, 
      mobile, 
      email, 
      telegram, 
      country, 
      agentEmail: agentEmail, 
      password: hashedPassword,
      role: "user", 
      status: "pending", 
      balance: 0, 
      otpRate: 0.50, 
      apiKey: newApiKey,       // ডাটাবেসে API Key সেভ হলো
      isApiActive: false,      // ডিফল্টভাবে API অফ থাকবে (এডমিন অন করবে)
    });

    await newUser.save();

    return NextResponse.json({ message: "Account Created Successfully! Waiting for Agent approval." }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}