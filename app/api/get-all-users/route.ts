export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 

export async function GET() {
  try {
    await connectToDatabase();
    
    const users = await User.find({}).select("-password").sort({ createdAt: -1 });

    const formattedUsers = users.map(u => ({
      id: u._id,
      uid: `ZX-${u._id.toString().substring(18, 24).toUpperCase()}`,
      name: u.fullName,
      email: u.email,
      role: u.role,
      agentEmail: u.agentEmail || "Admin",
      balance: u.balance || 0,
      status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
      todayOTP: 0,
      rate: u.otpRate || "0.50",
      customAgentMail: u.customAgentMail || "", 
      telegramLink: u.telegramLink || "",
      agentMaxUsers: u.agentMaxUsers || 100        
    }));

    return NextResponse.json({ users: formattedUsers }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 });
  }
}