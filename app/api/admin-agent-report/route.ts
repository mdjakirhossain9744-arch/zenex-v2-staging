export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";
import DailyStat from "../../../models/DailyStat"; 
import Redis from "ioredis";

const redis = new Redis(); 
const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

const getUTCDateString = (dateObj: any = new Date()) => {
  try { 
    return new Intl.DateTimeFormat('en-CA', { 
        timeZone: 'UTC', 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).format(new Date(dateObj)); 
  } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });

    try {
      const payloadBase64 = token.split('.')[1];
      const decodedString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const decodedPayload = JSON.parse(decodedString);
      if (decodedPayload.role !== "admin") {
        return NextResponse.json({ message: "🔴 FORBIDDEN: Admins only!" }, { status: 403 });
      }
    } catch (err) {
      return NextResponse.json({ message: "🔴 FORBIDDEN: Invalid Token!" }, { status: 403 });
    }

    const CACHE_KEY = "admin_agent_report_cache";
    const cachedData = await redis.get(CACHE_KEY).catch(() => null);
    if (cachedData) {
        return NextResponse.json(JSON.parse(cachedData), { status: 200 });
    }

    await connectToDatabase();

    if (Order.collection && DailyStat.collection && User.collection) {
        Promise.all([
            Order.collection.createIndex({ dateString: 1, status: 1 }).catch(() => {}),
            DailyStat.collection.createIndex({ dateString: -1 }).catch(() => {}),
            User.collection.createIndex({ role: 1, agentEmail: 1 }).catch(() => {})
        ]).catch(() => {});
    }

    const now = new Date();
    const todayStrUTC = getUTCDateString(now);
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); 
    const startOfMonthStr = getUTCDateString(startOfMonth);

    const [agents, users] = await Promise.all([
        User.find({ role: "agent" }).lean(),
        User.find({ role: "user", agentEmail: { $ne: null } }).select("email agentEmail otpRate").lean(),
    ]);

    const agentStats: Record<string, any> = {};
    
    agents.forEach((a: any) => {
        const safeEmail = (a.email || "").toLowerCase().trim();
        agentStats[safeEmail] = {
            name: a.fullName,
            email: safeEmail,
            customMail: (a.customAgentMail || "").toLowerCase().trim(),
            agentRate: Number(a.agentMaxRate || 0.70),
            thisMonthOTPs: 0,
            todayOTPs: 0,
            thisMonthCommission: 0 
        };
    });

    const userToAgentMap: Record<string, { agentEmail: string, userRate: number }> = {};
    
    users.forEach((u: any) => {
        const uEmail = (u.email || "").toLowerCase().trim();
        const aEmail = (u.agentEmail || "").toLowerCase().trim();
        userToAgentMap[uEmail] = {
            agentEmail: aEmail,
            userRate: Number(u.otpRate || 0.50)
        };
    });

    const archivedKeys = new Set<string>();

    const dailyStatsCursor = DailyStat.find({ dateString: { $gte: startOfMonthStr } }).cursor();
    let dsCount = 0;

    for await (const ds of dailyStatsCursor) {
        const dDate = ds.dateString;
        const uEmail = (ds.userEmail || "").toLowerCase().trim();
        archivedKeys.add(`${dDate}_${uEmail}`);

        if (ds.successOTP > 0 && userToAgentMap[uEmail]) {
            let aEmail = userToAgentMap[uEmail].agentEmail;
            
            let targetAgent = agentStats[aEmail];
            if (!targetAgent) targetAgent = Object.values(agentStats).find(a => a.customMail === aEmail);

            if (targetAgent) {
                targetAgent.thisMonthOTPs += ds.successOTP;
                if (dDate === todayStrUTC) targetAgent.todayOTPs += ds.successOTP;
                
                const commission = ds.totalCommission !== undefined 
                    ? ds.totalCommission 
                    : (Math.max(0, targetAgent.agentRate - userToAgentMap[uEmail].userRate) * ds.successOTP);
                
                targetAgent.thisMonthCommission += commission;
            }
        }
        if (++dsCount % 500 === 0) await yieldToEventLoop();
    }

    // 💥 THE DB KILLER FIX: ONLY FETCH TODAY'S ORDERS! 💥
    // past days are already covered by DailyStat, no need to fetch 500k monthly rows!
    const ordersCursor = Order.find({ 
        dateString: todayStrUTC, // <--- FIXED THIS!
        status: { $in: ["DONE", "Success", "SUCCESS"] }
    }).select("userEmail fullMessage createdAt updatedAt dateString orderCommission").cursor();
    
    let oCount = 0;

    for await (const o of ordersCursor) {
        const oDate = getUTCDateString(o.updatedAt || o.createdAt || new Date(o.dateString));
        const uEmail = (o.userEmail || "").toLowerCase().trim();
        
        if (oDate !== todayStrUTC && archivedKeys.has(`${oDate}_${uEmail}`)) continue;

        const msgLower = (o.fullMessage || "").toLowerCase();
        const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

        const msgArray = o.fullMessage ? o.fullMessage.split(/_\|\|_/) : [];
        let validMsgCount = 0;
        
        msgArray.forEach((m: string) => {
            const cleanMsg = m.trim().toLowerCase();
            if (cleanMsg !== "" && !cleanMsg.includes("waiting")) {
                validMsgCount += 1;
            }
        });

        if (validMsgCount === 0) validMsgCount = 1; 

        if (userToAgentMap[uEmail]) {
            let aEmail = userToAgentMap[uEmail].agentEmail;
            
            let targetAgent = agentStats[aEmail];
            if (!targetAgent) {
                const matchedByCustom = Object.values(agentStats).find(a => a.customMail === aEmail);
                if (matchedByCustom) targetAgent = matchedByCustom;
            }

            if (targetAgent) {
                targetAgent.thisMonthOTPs += validMsgCount;
                if (oDate === todayStrUTC) targetAgent.todayOTPs += validMsgCount; 
                
                if (!isFreeService) {
                    const commission = o.orderCommission !== undefined 
                        ? o.orderCommission 
                        : (Math.max(0, targetAgent.agentRate - userToAgentMap[uEmail].userRate) * validMsgCount);
                    
                    targetAgent.thisMonthCommission += commission;
                }
            }
        }
        if (++oCount % 500 === 0) await yieldToEventLoop();
    }

    const finalReport = Object.values(agentStats)
        .sort((a, b) => b.thisMonthOTPs - a.thisMonthOTPs)
        .map(a => ({
            agentName: a.name,
            agentEmail: a.email,
            monthOTPs: a.thisMonthOTPs,
            todayOTPs: a.todayOTPs, 
            agentEarnings: Number(a.thisMonthCommission).toFixed(2) 
        }));

    const responsePayload = { 
        success: true, 
        currentMonth: now.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' }), 
        report: finalReport 
    };

    await redis.set(CACHE_KEY, JSON.stringify(responsePayload), "EX", 60).catch(() => null);

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}