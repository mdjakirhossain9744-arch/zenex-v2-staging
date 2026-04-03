import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Setting from "../../../models/Setting"; 

// 💥 শক্তিশালী API Key জেনারেটর (ZNX_ + ২৪ ক্যারেক্টারের র‍্যান্ডম কোড) 💥
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
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" }, 
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({ email });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" }, 
        { status: 404 }
      );
    }

    // 💥 অটো-ফিক্স: যদি পুরোনো ইউজারের API Key না থাকে, তবে নতুন তৈরি করে দাও 💥
    if (!user.apiKey || user.apiKey === "") {
      const newApiKey = generateApiKey();
      user.apiKey = newApiKey;
      await user.save(); // ডাটাবেসে সেভ করে নিলাম
    }

    // 💥 ইউজারের আসল এজেন্টের ডাটা খোঁজা 💥
    let agent = null;
    if (user.agentEmail) {
      agent = await User.findOne({
        $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
        role: { $in: ["agent", "admin"] }
      }).select("fullName customAgentMail email telegramLink telegram");
    }

    // 💥 গ্লোবাল সাপোর্ট লিংক ডাটাবেস থেকে আনা 💥
    let globalSupportLink = "https://t.me/Zenexacademy1";
    try {
      const setting = await Setting.findOne({ key: "GLOBAL_SUPPORT_LINK" });
      if (setting) globalSupportLink = setting.value;
    } catch (e) { 
      console.error("Setting fetch error:", e);
    }

    return NextResponse.json({ success: true, user, agent, globalSupportLink });

  } catch (error) {
    console.error("Error fetching user details:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" }, 
      { status: 500 }
    );
  }
}