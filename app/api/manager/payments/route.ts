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

    // 1. Token Verification
    const token = req.cookies.get('zenex_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'zenex_secret');
    if (decoded.role !== 'agent' && decoded.role !== 'admin' && decoded.role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Query Params Parsing
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const skip = (page - 1) * limit;

    let matchStage: any = {};
    
    // 💥 THE EXACT ORIGINAL LOGIC FROM YOUR SYSTEM 💥
    if (decoded.role === 'agent' || decoded.role === 'manager') {
      
      const agentId = decoded.id || decoded._id || decoded.userId;
      const currentAgent = await User.findById(agentId);
      
      if (currentAgent) {
        const agentPrimaryEmail = currentAgent.email;
        const agentCustomMail = currentAgent.customAgentMail || agentPrimaryEmail;

        // Finding users using exact agentEmail match (Just like your get-agent-users API)
        const users = await User.find({ 
          $or: [
            { agentEmail: agentPrimaryEmail }, 
            { agentEmail: agentCustomMail }
          ],
          role: "user"
        }).select('email');
        
        const userEmails = users.map((u: any) => u.email);
        
        if (userEmails.length > 0) {
            matchStage.email = { $in: userEmails };
        } else {
            // No users found for this agent
            matchStage.email = "NO_USERS_FOUND_FOR_THIS_AGENT_123"; 
        }
      } else {
        matchStage.email = "NO_USERS_FOUND_FOR_THIS_AGENT_123";
      }
    }

    // 3. Search Filtering
    if (search) {
      matchStage.$or = [
        { wid: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // 4. Zero-Load Fast Aggregation
    const result = await Withdraw.aggregate([
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
          ],
          totalCount: [{ $count: 'count' }],
          stats: [
            {
              $group: {
                _id: null,
                totalDistributed: { 
                  $sum: { $cond: [{ $in: [{ $toUpper: '$status' }, ['PAID', 'COMPLETED']] }, '$amount', 0] } 
                },
                completedMonth: {
                  $sum: { $cond: [{ $and: [{ $in: [{ $toUpper: '$status' }, ['PAID', 'COMPLETED']] }, { $gte: ['$createdAt', startOfMonth] }] }, 1, 0] }
                },
                totalPending: {
                  $sum: { $cond: [{ $in: [{ $toUpper: '$status' }, ['PENDING', 'PROCESSING']] }, 1, 0] }
                },
                totalTransactions: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    const formattedData = result[0];
    const stats = formattedData.stats[0] || { totalDistributed: 0, completedMonth: 0, totalPending: 0, totalTransactions: 0 };
    const totalPages = Math.ceil((formattedData.totalCount[0]?.count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: formattedData.data,
      stats,
      pagination: { page, limit, totalPages }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}