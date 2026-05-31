import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import connectToDatabase from '../../../lib/mongodb';
import Withdraw from '../../../../models/Withdraw';
import User from '../../../../models/User';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();

    const token = req.cookies.get('zenex_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'zenex_secret');
    if (decoded.role !== 'agent' && decoded.role !== 'admin' && decoded.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const passedAgentEmail = searchParams.get('agentEmail') || decoded.email;
    const skip = (page - 1) * limit;

    let query: any = {};

    // 💥 1. FAIL-SAFE AGENT FILTER LOGIC 💥
    if (decoded.role !== 'admin') {
       const agent = await User.findOne({
         $or: [{ email: passedAgentEmail }, { customAgentMail: passedAgentEmail }],
       });

       let userEmails: any[] = [];
       if (agent) {
          const users = await User.find({
            $or: [{ agentEmail: agent.email }, { agentEmail: agent.customAgentMail }]
          }).select("email");
          
          // Case Insensitive Array Search (Fixes uppercase/lowercase email issues)
          userEmails = users.map(u => new RegExp('^' + (u.email || "").trim() + '$', 'i'));
       }

       if (userEmails.length > 0) {
          query.email = { $in: userEmails };
       } else {
          query.email = "FORCE_EMPTY_RESULT_NO_USERS_123"; 
       }
    }

    // 💥 2. SEARCH LOGIC 💥
    if (search) {
       query.$and = query.$and || [];
       query.$and.push({
         $or: [
           { wid: { $regex: search, $options: 'i' } },
           { email: { $regex: search, $options: 'i' } },
           { name: { $regex: search, $options: 'i' } }
         ]
       });
    }

    // 💥 3. EXACT METHOD FROM YOUR WORKING ADMIN API (.find) 💥
    const totalItems = await Withdraw.countDocuments(query);
    const requests = await Withdraw.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    // 💥 4. ZERO-LOAD STATS CALCULATION 💥
    const allFiltered = await Withdraw.find(query).select("amount status createdAt");
    let tDist = 0, cMonth = 0, tPend = 0, tTrans = allFiltered.length;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    allFiltered.forEach(tx => {
       const st = (tx.status || "").toUpperCase();
       const amt = Number(tx.amount) || 0;
       const txTime = new Date(tx.createdAt).getTime();

       if (st === "PAID" || st === "COMPLETED") {
           tDist += amt;
           if (txTime >= startOfMonth) cMonth++;
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
    console.error("PAYMENT API ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}