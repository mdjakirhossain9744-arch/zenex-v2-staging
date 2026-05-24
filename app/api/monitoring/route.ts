import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User"; 

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    
    // role: "admin" বা "agent" আসবে
    const { role, email } = body;

    if (!role || !email) {
       return NextResponse.json({ success: false, data: [] });
    }

    let query: any = {};
    
    // 💥 যদি রিকোয়েস্টটি কোনো এজেন্টের হয় 💥
    if (role === "agent") {
      const agentUser = await User.findOne({ email: email.toLowerCase() }).lean();
      
      if (!agentUser) {
         return NextResponse.json({ success: true, data: [] });
      }

      const emailsToMatch = [agentUser.email];
      if (agentUser.customAgentMail) {
         emailsToMatch.push(agentUser.customAgentMail);
      }

      const networkUsers = await User.find({
        agentEmail: { $in: emailsToMatch }
      }).select("email").lean();

      const targetEmails = networkUsers.map((u: any) => u.email.toLowerCase());

      if (targetEmails.length === 0) {
         return NextResponse.json({ success: true, data: [] });
      }

      // Order ডাটাবেস থেকে খোঁজ করার সময় case-insensitive (ছোট-বড় সব হাতের ইমেইল) করা হলো
      query = { userEmail: { $in: targetEmails.map(e => new RegExp(`^${e}$`, "i")) } };
    }

    // 💥 Zero-Load Query: লেটেস্ট ৫০টি অর্ডার আনা হচ্ছে 💥
    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50) 
      .lean(); 

    if (liveOrders.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 💥 Bulletproof User Info Mapping (নাম এবং আইডি ফিক্স) 💥
    // ইমেইলগুলোকে ছোট হাতের অক্ষরে কনভার্ট করে ইউনিক করা হলো
    const uniqueUserEmails = [...new Set(liveOrders.map((o: any) => o.userEmail?.toLowerCase()).filter(Boolean))];
    
    // Case-insensitive ইমেইল দিয়ে User ডাটাবেস থেকে নাম এবং আইডি আনা
    const usersInfo = await User.find({ 
        email: { $in: uniqueUserEmails.map(e => new RegExp(`^${e}$`, "i")) } 
    }).select("email name uid _id").lean();

    const userMap = usersInfo.reduce((acc: any, user: any) => {
      if(user.email) {
         acc[user.email.toLowerCase()] = { 
           // যদি নাম না থাকে, তবে ইমেইলের @ এর আগের অংশটুকু নাম হিসেবে দেখাবে
           name: user.name || user.email.split('@')[0], 
           // যদি uid না থাকে, তবে ডাটাবেসের _id এর শেষ ৬ ডিজিট দেখাবে
           uid: user.uid || user._id.toString().substring(18, 24).toUpperCase() 
         };
      }
      return acc;
    }, {});

    const formattedData = liveOrders.map((order: any) => {
      const emailKey = order.userEmail?.toLowerCase();
      // ইউজারের ইমেইলের প্রথম অংশ (ফলব্যাক হিসেবে)
      const fallbackName = emailKey ? emailKey.split('@')[0] : "User";
      
      return {
        ...order,
        userName: userMap[emailKey]?.name || fallbackName,
        userUid: userMap[emailKey]?.uid || "SYS-001"
      };
    });

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], message: "Monitoring Fetch Error" });
  }
}