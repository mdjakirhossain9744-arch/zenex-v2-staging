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
    const { action, email, binancePayId, isAutoWithdraw, withdrawPin } = await req.json();

    if (!email) {
      return NextResponse.json(
        { success: false, message: "Email is required" }, 
        { status: 400 }
      );
    }

    await connectToDatabase();

    // 💥 Auto-Pay Settings Save Logic with strict Security PIN Validation 💥
    if (action === "UPDATE_AUTO_PAY") {
        if (!withdrawPin) {
           return NextResponse.json({ success: false, message: "Security PIN is required!" }, { status: 400 });
        }

        const user = await User.findOne({ email });
        if (!user) {
           return NextResponse.json({ success: false, message: "User not found!" }, { status: 404 });
        }

        if ((user.withdrawPin || "1234") !== withdrawPin.trim()) {
           return NextResponse.json({ success: false, message: "🔴 Invalid Security PIN! Settings not saved." }, { status: 403 });
        }

        await User.findOneAndUpdate(
            { email }, 
            { $set: { binancePayId, isAutoWithdraw } }
        );
        return NextResponse.json({ success: true, message: "Settings Updated Successfully" });
    }

    // 💥 Fetch User Logic (Zero DB Load via .lean()) 💥
    const user = await User.findOne({ email }).lean();

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" }, 
        { status: 404 }
      );
    }

    // অটো-ফিক্স: API Key না থাকলে জেনারেট করে আপডেট করা
    if (!user.apiKey || user.apiKey === "") {
      const newApiKey = generateApiKey();
      user.apiKey = newApiKey;
      await User.updateOne({ _id: user._id }, { $set: { apiKey: newApiKey } });
    }

    // 💥 MASTER PRIVACY LOGIC: Hide Real Agent Email 💥
    let agent = null;
    let displayAgentEmail = user.agentEmail; // বাই ডিফল্ট যেটা আছে সেটাই থাকবে

    if (user.agentEmail) {
      // 💥 SECURITY: .select() থেকে 'email' বাদ দেওয়া হয়েছে যাতে নেটওয়ার্ক ট্যাবেও লিক না হয়! 💥
      const foundAgent = await User.findOne({
        $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
        role: { $in: ["agent", "admin"] }
      }).select("fullName customAgentMail telegramLink telegram").lean();

      if (foundAgent) {
         agent = foundAgent;
         
         // যদি এজেন্টের কাস্টম মেইল থাকে, তবে ইউজারের কাছে আসল মেইলের বদলে কাস্টম মেইল শো করাবে
         if (foundAgent.customAgentMail && foundAgent.customAgentMail.trim() !== "") {
             displayAgentEmail = foundAgent.customAgentMail;
         }
      }
    }

    // ইউজারের ডাটাতে মেইলটি ওভাররাইড (Override) করা হলো
    user.agentEmail = displayAgentEmail;

    // গ্লোবাল সাপোর্ট লিংক ডাটাবেস থেকে আনা
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