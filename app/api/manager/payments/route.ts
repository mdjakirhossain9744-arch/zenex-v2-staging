import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '../../../lib/mongodb';
import Withdraw from '../../../../models/Withdraw';
import User from '../../../../models/User';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // 💥 1. SECURITY FIX: Exactly matching your system's token check 💥
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

    // 💥 2. AGENT FILTER LOGIC (100% Fail-Proof) 💥
    if (role !== 'admin') {
       if (!passedAgentEmail) {
           return NextResponse.json({ success: true, data: [] });
       }

       // Find the Agent
       const agent = await User.findOne({
         $or: [{ email: passedAgentEmail }, { customAgentMail: passedAgentEmail }]
       });

       if (!agent) {
           return NextResponse.json({ success: true, data: [] });
       }

       // Find Users under this Agent
       const users = await User.find({
         $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }]
       }).select("email");
       
       const userEmails = users.map(u => (u.email || "").trim());

       if (userEmails.length === 0) {
           return NextResponse.json({ success: true, data: [] });
       }

       // Create case-insensitive exact match for MongoDB (Safest method)
       const emailRegexArr = userEmails.map(e => ({ email: { $regex: new RegExp(`^${e}$`, 'i') } }));
       query.$or = emailRegexArr;
    }

    // 💥 3. SEARCH LOGIC 💥
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

    // 💥 4. DATABASE FETCH 💥
    const totalItems = await Withdraw.countDocuments(query);
    const requests = await Withdraw.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();

    // 💥 5. ZERO-LOAD STATS CALCULATION 💥
    const allFiltered = await Withdraw.find(query).select("amount status createdAt date").lean();
    let tDist = 0, cMonth = 0, tPend = 0, tTrans = allFiltered.length;
    const currentMonth = new Date().getMonth();

    allFiltered.forEach(tx => {
       const st = (tx.status || "").toUpperCase();
       const amt = Number(tx.amount) || 0;
       const txTime = new Date(tx.createdAt || tx.date);

       if (st === "PAID" || st === "COMPLETED") {
           tDist += amt;
           if (txTime.getMonth() === currentMonth) cMonth++;
       }
       if (st === "PENDING" || st === "PROCESSING") {
           tPend++;
       }
    });

    return NextResponse.json({
      success: true,
      data: requests,
      stats: {
         totalDistributed: tDist,
         completedMonth: cMonth,
         totalPending: tPend,
         totalTransactions: tTrans
      },
      pagination: { page, limit, totalPages: Math.ceil(totalItems / limit) || 1 }
    });

  } catch (error: any) {
    console.error("PAYMENT API ERROR:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}