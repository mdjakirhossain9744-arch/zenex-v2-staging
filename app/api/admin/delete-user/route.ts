// app/api/admin/delete-user/route.ts

import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import User from "../../../../models/User";
import Order from "../../../../models/Order";
import Notification from "../../../../models/Notification";
import Withdraw from "../../../../models/Withdraw";
import DailyStat from "../../../../models/DailyStat";

export async function DELETE(request: Request) {
  try {
    await connectToDatabase();

    const requesterEmail = request.headers.get('X-User-Email');
    const requesterRole = request.headers.get('X-User-Role');

    if (!requesterEmail || (requesterRole !== 'admin' && requesterRole !== 'agent')) {
      return NextResponse.json({ message: "Unauthorized Access" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const targetEmail = searchParams.get('email');

    if (!targetEmail) {
      return NextResponse.json({ message: "User email is required" }, { status: 400 });
    }

    if (targetEmail === requesterEmail) {
      return NextResponse.json({ message: "You cannot delete your own account" }, { status: 400 });
    }

    const targetUser = await User.findOne({ email: targetEmail });

    if (!targetUser) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (targetUser.role === 'admin' || targetUser.role === 'agent') {
      return NextResponse.json({ message: "Cannot delete Admin or Agent accounts" }, { status: 403 });
    }

    // 🔥 এজেন্ট পারমিশন চেক (বুলেটপ্রুফ লজিক) 🔥
    if (requesterRole === 'agent') {
      // এজেন্টের ডাটাবেস থেকে তার তথ্য নিচ্ছি
      const agent = await User.findOne({ email: requesterEmail });
      
      if (!agent) {
        return NextResponse.json({ message: "Agent account not found" }, { status: 403 });
      }

      // এজেন্টের মূল ইমেইল এবং কাস্টম ইমেইলের একটি লিস্ট বানাচ্ছি (খালি মেইল বাদ দিয়ে)
      const validAgentEmails = [agent.email, agent.customAgentMail].filter(mail => mail && mail.trim() !== "");
      
      // চেক করছি ইউজারের agentEmail কি এজেন্টের যেকোনো একটি ইমেইলের সাথে মিলে কি না
      const isOwnUser = validAgentEmails.includes(targetUser.agentEmail);
      
      if (!isOwnUser) {
        return NextResponse.json({ message: "Agents can only delete their own network users" }, { status: 403 });
      }
    }

    // সব ডেটা ডিলিট করা
    await Order.deleteMany({ userEmail: targetEmail });
    await Notification.deleteMany({ userEmail: targetEmail });
    await Withdraw.deleteMany({ email: targetEmail });
    await DailyStat.deleteMany({ userEmail: targetEmail });
    
    await User.deleteOne({ email: targetEmail });

    console.log(`✅ USER DELETED: ${targetEmail} by ${requesterRole} (${requesterEmail})`);

    return NextResponse.json({ 
      success: true, 
      message: `User '${targetEmail}' and all associated data deleted successfully` 
    }, { status: 200 });

  } catch (error: any) {
    console.error("DELETE_ERROR:", error);
    return NextResponse.json({ message: "Server Error: " + error.message }, { status: 500 });
  }
}