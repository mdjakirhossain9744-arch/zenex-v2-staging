import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User"; // 💥 ইউজারের নাম এবং আইডি আনার জন্য User মডেল ইম্পোর্ট করা হলো

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
      // ১. এজেন্টের প্রোফাইল খুঁজে তার মেইন এবং কাস্টম ইমেইল বের করা
      const agentUser = await User.findOne({ email: email.toLowerCase() }).lean();
      
      if (!agentUser) {
         return NextResponse.json({ success: true, data: [] });
      }

      const emailsToMatch = [agentUser.email];
      if (agentUser.customAgentMail) {
         emailsToMatch.push(agentUser.customAgentMail);
      }

      // ২. এই এজেন্টের আন্ডারে থাকা সব ইউজারদের খুঁজে বের করা
      const networkUsers = await User.find({
        agentEmail: { $in: emailsToMatch }
      }).select("email").lean();

      const targetEmails = networkUsers.map((u: any) => u.email);

      // যদি এজেন্টের কোনো ইউজার না থাকে, তবে ফাঁকা ডাটা রিটার্ন করবে
      if (targetEmails.length === 0) {
         return NextResponse.json({ success: true, data: [] });
      }

      // ৩. এখন ওই ইউজারদের ইমেইল দিয়ে Order ডাটাবেসে ফিল্টার করা
      query = { userEmail: { $in: targetEmails } };
    }
    // Admin হলে query ফাঁকা থাকবে, মানে সবার ডাটা দেখাবে!

    // 💥 Zero-Load Query: .lean() দিয়ে ডাটা আনা হচ্ছে 💥
    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(50) // সর্বোচ্চ ৫০টি লেটেস্ট অর্ডার দেখাবে
      .lean(); 

    if (liveOrders.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // 💥 অর্ডারের সাথে ইউজারের Name এবং UID যুক্ত করা (যাতে ফ্রন্টএন্ড টেবিলে ইউজারের নাম শো করে) 💥
    const uniqueUserEmails = [...new Set(liveOrders.map((o: any) => o.userEmail))];
    const usersInfo = await User.find({ email: { $in: uniqueUserEmails } })
      .select("email name uid")
      .lean();

    const userMap = usersInfo.reduce((acc: any, user: any) => {
      acc[user.email] = { name: user.name, uid: user.uid };
      return acc;
    }, {});

    const formattedData = liveOrders.map((order: any) => ({
      ...order,
      userName: userMap[order.userEmail]?.name || "User",
      userUid: userMap[order.userEmail]?.uid || "N/A"
    }));

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], message: "Monitoring Fetch Error" });
  }
}