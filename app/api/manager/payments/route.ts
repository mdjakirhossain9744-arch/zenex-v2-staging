import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../lib/mongodb';
import Withdraw from '../../../../models/Withdraw';
import User from '../../../../models/User';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ success: false, message: "🔴 UNAUTHORIZED" }, { status: 401 });

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const passedAgentEmail = searchParams.get('agentEmail') || '';
    const role = searchParams.get('role') || 'agent'; 
    const skip = (page - 1) * limit;

    let query: any = {};

    if (role !== 'admin') {
       if (!passedAgentEmail) {
           return NextResponse.json({ success: true, data: [] });
       }

       const agent = await User.findOne({
         $or: [{ email: passedAgentEmail }, { customAgentMail: passedAgentEmail }]
       });

       if (!agent) {
           return NextResponse.json({ success: true, data: [] });
       }

       const users = await User.find({
         $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }]
       }).select("email");
       
       const userEmails = users.map(u => (u.email || "").trim());

       if (userEmails.length === 0) {
           return NextResponse.json({ success: true, data: [] });
       }

       const emailRegexArr = userEmails.map(e => ({ email: { $regex: new RegExp(`^${e}$`, 'i') } }));
       query.$or = emailRegexArr;
    }

    if (search) {
       const searchFilter = {
         $or: [
           { wid: { $regex: search, $options: 'i' } },
           { email: { $regex: search, $options: 'i' } },
           { name: { $regex: search, $options: 'i' } },
           { accountNumber: { $regex: search, $options: 'i' } }
         ]
       };

       if (query.$or) {
          query = { $and: [ { $or: query.$or }, searchFilter ] };
       } else {
          query = searchFilter;
       }
    }

    const totalItems = await Withdraw.countDocuments(query);
    const requests = await Withdraw.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    const allFiltered = await Withdraw.find(query).select("amount status").lean();
    
    // 💥 ADDED: Rejected Count Logic 💥
    let tDist = 0, tPend = 0, tApprovedCount = 0, tRejectedCount = 0;

    allFiltered.forEach(tx => {
       const st = (tx.status || "").toUpperCase();
       const amt = Number(tx.amount) || 0;

       if (st === "PAID" || st === "COMPLETED") {
           tDist += amt;
           tApprovedCount++; 
       } else if (st === "PENDING" || st === "PROCESSING") {
           tPend++;
       } else if (st === "REJECTED") {
           tRejectedCount++; 
       }
    });

    return NextResponse.json({
      success: true,
      data: requests,
      stats: {
         totalDistributed: tDist,
         totalRejectedCount: tRejectedCount,
         totalPending: tPend,
         totalApprovedCount: tApprovedCount 
      },
      pagination: { page, limit, totalPages: Math.ceil(totalItems / limit) || 1 }
    });

  } catch (error: any) {
    console.error("PAYMENT API ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}