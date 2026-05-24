import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    
    const { role, email, filterStatus, limit } = body;

    if (!role || !email) return NextResponse.json({ success: false, data: [] });

    let query: any = {};
    
    if (filterStatus && filterStatus !== "ALL") {
      if (filterStatus === "SUCCESS") query.status = "DONE";
      else if (filterStatus === "PENDING") query.status = "WAIT";
      else if (filterStatus === "FAILED") query.status = { $in: ["CANCEL", "FAILED", "TIMEOUT"] }; 
    }

    if (role === "agent") {
      const agentEmailLower = email.trim().toLowerCase();
      const agentUser = await User.findOne({ 
        email: { $regex: new RegExp(`^${agentEmailLower}$`, "i") } 
      }).lean();
      
      if (!agentUser) return NextResponse.json({ success: true, data: [] });

      const emailsToMatch = [agentUser.email];
      if (agentUser.customAgentMail) emailsToMatch.push(agentUser.customAgentMail);

      const networkUsers = await User.find({
        agentEmail: { $in: emailsToMatch.map(e => new RegExp(`^${e.trim()}$`, "i")) }
      }).select("email").lean();

      if (networkUsers.length === 0) return NextResponse.json({ success: true, data: [] });

      const targetEmails = networkUsers.map((u: any) => u.email.trim());
      query.userEmail = { $in: targetEmails.map(e => new RegExp(`^${e}$`, "i")) };
    }

    const fetchLimit = Number(limit) || 50; 
    const liveOrders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(fetchLimit)
      .lean(); 

    if (liveOrders.length === 0) return NextResponse.json({ success: true, data: [] });

    // 💥 TRIM ADDED: ইমেইলের স্পেস বাগ ফিক্স 💥
    const rawEmails = liveOrders.map((o: any) => o.userEmail?.trim()).filter(Boolean);
    const uniqueEmails = [...new Set(rawEmails)];
    
    const usersInfo = await User.find({ 
        email: { $in: uniqueEmails.map(e => new RegExp(`^${e}$`, "i")) } 
    }).select("email name uid _id").lean();

    const userMap: Record<string, any> = {};
    usersInfo.forEach((u: any) => {
        if (u.email) {
            const mailKey = u.email.trim().toLowerCase();
            const userUID = (u.uid && u.uid.trim() !== "") 
                ? u.uid 
                : `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`;

            // 💥 NAME FIX: স্পেস রিমুভ করে অরিজিনাল নাম আনা হয়েছে 💥
            userMap[mailKey] = {
                name: (u.name && u.name.trim() !== "") ? u.name.trim() : mailKey.split('@')[0], 
                uid: userUID
            };
        }
    });

    const formattedData = liveOrders.map((order: any) => {
      const mailKey = order.userEmail?.trim().toLowerCase() || "";
      return {
        ...order,
        userName: userMap[mailKey]?.name || (mailKey ? mailKey.split('@')[0] : "User"),
        userUid: userMap[mailKey]?.uid || "ZX-N/A"
      };
    });

    return NextResponse.json({ success: true, data: formattedData });
  } catch (error) {
    return NextResponse.json({ success: false, data: [], message: "Server Error" });
  }
}