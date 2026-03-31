import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, mobile, email, telegram, country, agentEmail, password } = body;

    await connectToDatabase();

    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      return NextResponse.json({ message: "এই ইমেইল বা নাম্বার দিয়ে আগে থেকেই একাউন্ট আছে!" }, { status: 400 });
    }

    // 💥 এজেন্ট ভেরিফিকেশন এবং সিট লিমিট চেক 💥
    if (agentEmail !== "admin@zenexnetwork.com") {
      const validAgent = await User.findOne({ 
        $or: [{ customAgentMail: agentEmail }, { email: agentEmail }],
        role: "agent" 
      });

      if (!validAgent) {
        return NextResponse.json({ message: "Invalid Agent Email! Please contact an authorized agent." }, { status: 400 });
      }

      // 💥 ম্যাজিক: এজেন্টের আন্ডারে বর্তমানে কতজন ইউজার আছে সেটা গোনা হচ্ছে 💥
      const totalAgentUsers = await User.countDocuments({
        $or: [
          { agentEmail: validAgent.email }, 
          { agentEmail: validAgent.customAgentMail }
        ],
        role: "user"
      });

      // লিমিট চেক করা হচ্ছে (যদি লিমিট সেট করা না থাকে, তাহলে ডিফল্ট ১০০ ধরবে)
      const maxLimit = validAgent.agentMaxUsers || 100;
      
      if (totalAgentUsers >= maxLimit) {
        return NextResponse.json({ message: `দুঃখিত! এই এজেন্টের সিট ফুল হয়ে গেছে (${maxLimit}/${maxLimit})। নতুন কেউ জয়েন করতে পারবে না।` }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // ইউজার বক্সে যা দিয়েছে (agentEmail) ঠিক সেটাই সেভ হবে
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
    });

    await newUser.save();

    return NextResponse.json({ message: "Account Created Successfully! Waiting for Agent approval." }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}