import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

// 💥 THE BOSS FIX: PER-AGENT CACHE LOCK & DATA STREAMING (Zero RAM Overload) 💥
let agentSummaryCache: Record<string, { data: any, timestamp: number }> = {};
let activeAgentLocks: Record<string, boolean> = {}; 
const CACHE_DURATION = 2 * 60 * 1000; // 2 Minutes 

const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const lowerMsg = msg.toLowerCase();
    
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ')) return 'WhatsApp';
    if (lowerMsg.includes('telegram') || lowerMsg.includes('t.me')) return 'Telegram';
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'Facebook';
    if (lowerMsg.includes('instagram') || lowerMsg.includes(' ig ')) return 'Instagram';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg) || lowerMsg.includes('gmail')) return 'Google';
    if (lowerMsg.includes('microsoft') || lowerMsg.includes('outlook')) return 'Microsoft';
    if (lowerMsg.includes('amazon') || lowerMsg.includes('aws')) return 'Amazon';
    if (lowerMsg.includes('netflix')) return 'Netflix';
    if (lowerMsg.includes('paypal')) return 'PayPal';
    if (lowerMsg.includes('tiktok')) return 'TikTok';
    if (lowerMsg.includes('tinder')) return 'Tinder';
    if (lowerMsg.includes('uber')) return 'Uber';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    return "Other"; 
};

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const getUTCHour = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).getUTCHours(); } 
  catch(e) { return 0; }
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { email, limitDays = 60 } = body;
  if (!email) return NextResponse.json({ success: false, message: "Email required" });

  const safeAgentEmail = email.toLowerCase().trim();
  // 💥 CACHE KEY CHANGED to bypass old inaccurate cache
  const cacheKey = `agent_v3_exact_${safeAgentEmail}_${limitDays}`;
  const now = Date.now();

  try {
    if (agentSummaryCache[cacheKey] && (now - agentSummaryCache[cacheKey].timestamp < CACHE_DURATION)) {
        return NextResponse.json(agentSummaryCache[cacheKey].data);
    }

    if (activeAgentLocks[cacheKey] && agentSummaryCache[cacheKey]) {
        return NextResponse.json(agentSummaryCache[cacheKey].data); 
    }

    activeAgentLocks[cacheKey] = true;
    await connectToDatabase();

    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') }).lean();
    if (!agent) {
        delete activeAgentLocks[cacheKey];
        return NextResponse.json({ success: false, message: "Agent not found" });
    }

    const exactAgentEmail = agent.email;
    const customAgentEmail = agent.customAgentMail;
    
    const agentEmailArray = [exactAgentEmail];
    if (customAgentEmail) agentEmailArray.push(customAgentEmail);

    const networkUsers = await User.find({ agentEmail: { $in: agentEmailArray }, role: "user" })
      .select("email otpRate fullName uid _id lastLogin createdAt balance status")
      .lean();

    const exactTargetEmails = [exactAgentEmail];
    if (customAgentEmail) exactTargetEmails.push(customAgentEmail);
    
    const userInfoMap: Record<string, any> = {}; 

    networkUsers.forEach((u: any) => {
        if (u.email) {
            exactTargetEmails.push(u.email);
            userInfoMap[u.email.toLowerCase()] = {
                id: u.uid || `ZX-${u._id?.toString().substring(18, 24).toUpperCase() || 'UNKNOWN'}`,
                name: u.fullName || u.email.split('@')[0],
                todayOTP: 0 
            };
        }
    });

    const agentMaxRate = agent.agentMaxRate || 0.70;
    const todayStrUTC = getUTCDateString(new Date());
    const isAllTime = limitDays === "all";
    
    let liveQueryDateStr = todayStrUTC;
    const currentUTCHour = new Date().getUTCHours();
    const currentUTCMin = new Date().getUTCMinutes();
    
    if (currentUTCHour === 0 && currentUTCMin <= 35) {
        const yesterdayDate = new Date();
        yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        liveQueryDateStr = getUTCDateString(yesterdayDate);
    }

    const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr } };

    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
    }

    if (exactTargetEmails.length > 0) {
        dailyStatQuery.$or = [
            { userEmail: { $in: exactTargetEmails } },
            { email: { $in: exactTargetEmails } }
        ];
    }

    const orderQuery: any = { dateString: { $gte: liveQueryDateStr } }; 
    if (exactTargetEmails.length > 0) {
        orderQuery.$or = [
            { userEmail: { $in: exactTargetEmails } },
            { email: { $in: exactTargetEmails } }
        ];
    }

    const dailyStatsAgg = await DailyStat.aggregate([
        { $match: dailyStatQuery },
        { $group: {
            _id: "$dateString",
            total: { $sum: { $ifNull: ["$totalNumbers", 0] } },
            allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
            success: { $sum: { $ifNull: ["$successOTP", 0] } },
            failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } },
            amount: { $sum: { $ifNull: ["$totalCommission", 0] } }
        }}
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    // 🔥 Exact Logic Application for Old Data
    dailyStatsAgg.forEach((ds: any) => {
        let finalTotal = ds.total || ds.allocation || 0;
        if (finalTotal === 0 && (ds.success > 0 || ds.failed > 0)) {
            finalTotal = ds.success + ds.failed;
        }
        groupedRawData[ds._id] = {
            total: finalTotal, allocation: finalTotal,
            success: ds.success, failed: ds.failed, amount: ds.amount
        };
    });
    
    // 💥 RAM SAVER: MongoDB Cursor Instead of Loading Full Array 💥
    // 🔥 Added `processedKeys` to selection
    const ordersCursor = Order.find(orderQuery)
        .select("status createdAt updatedAt dateString fullMessage userEmail email orderCommission processedKeys")
        .lean()
        .cursor(); 

    for await (const o of ordersCursor) {
       const currentStatus = (o.status || "").toUpperCase(); 
       const finalDateStr = o.dateString || getUTCDateString(o.createdAt);

       if (finalDateStr < liveQueryDateStr) continue;

       const safeUserEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       if (!groupedRawData[finalDateStr]) {
           groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       }
       
       groupedRawData[finalDateStr].total += 1;
       groupedRawData[finalDateStr].allocation += 1; 

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          
          // 🔥 EXACT MULTI-OTP LOGIC INJECTED 🔥
          let exactValidCount = 0;
          if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) {
              exactValidCount = o.processedKeys.length;
          } else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
              const msgArray = o.fullMessage.split(/_\|\|_/);
              msgArray.forEach((m: string) => {
                  const cleanMsg = m.trim().toLowerCase();
                  if (cleanMsg !== "" && !cleanMsg.includes("waiting")) exactValidCount += 1;
              });
          }
          if (exactValidCount === 0) exactValidCount = 1;

          groupedRawData[finalDateStr].success += exactValidCount;
          groupedRawData[finalDateStr].amount += (o.orderCommission || 0);

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

              if (userInfoMap[safeUserEmail]) userInfoMap[safeUserEmail].todayOTP += exactValidCount;

              let sName = extractServiceName(o.fullMessage);
              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += exactValidCount;
          }
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
           groupedRawData[finalDateStr].failed += 1; 
       }
    }

    const topPerformersArr = Object.values(userInfoMap)
       .map((u: any) => ({ id: u.id, name: u.name, otpCount: u.todayOTP }))
       .filter(u => u.otpCount > 0).sort((a, b) => b.otpCount - a.otpCount).slice(0, 15); 

    const nowTime = new Date().getTime();
    
    const activeNetworkUsers = networkUsers.filter((u: any) => {
        const s = (u.status || "active").toLowerCase();
        return s !== "banned" && s !== "pending" && s !== "suspended";
    });

    const inactiveUsersArr = activeNetworkUsers.map((u: any) => {
        const createdTime = new Date(u.createdAt || nowTime).getTime();
        const loginTime = u.lastLogin ? new Date(u.lastLogin).getTime() : null;
        let timeText = ""; let sortValue = 0; 
        
        if (loginTime) {
            sortValue = loginTime;
            const diffDays = Math.floor((nowTime - loginTime) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) timeText = "Today";
            else if (diffDays === 1) timeText = "Yesterday";
            else if (diffDays < 7) timeText = `${diffDays} days ago`;
            else if (diffDays < 30) {
                const weeks = Math.floor(diffDays / 7);
                timeText = weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
            } else if (diffDays < 365) {
                const months = Math.floor(diffDays / 30);
                timeText = months === 1 ? "1 month ago" : `${months} months ago`;
            } else {
                const years = Math.floor(diffDays / 365);
                timeText = years === 1 ? "1 year ago" : `${years} years ago`;
            }
        } else {
            sortValue = createdTime; 
            const diffDays = Math.floor((nowTime - createdTime) / (1000 * 60 * 60 * 24));
            if (diffDays > 3) timeText = "Never"; 
            else timeText = "New Account"; 
        }
        
        return {
            id: u.uid || `ZX-${u._id?.toString().substring(18, 24).toUpperCase() || 'UNKNOWN'}`,
            email: u.email,
            name: u.fullName || u.email.split('@')[0],
            inactiveText: timeText, 
            balance: u.balance || 0, 
            sortValue
        };
    }).sort((a, b) => a.sortValue - b.sortValue).slice(0, 15);

    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    const responseData = {
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate: agentMaxRate, balance: agent.agentEarning || 0, serverDate: todayStrUTC,
       topPerformers: topPerformersArr, inactiveUsers: inactiveUsersArr,
       todaySuccess: todayData.success, todayRevenue: todayData.amount, 
       yesterdaySuccess: yesterdayData.success, yesterdayRevenue: yesterdayData.amount
    };

    agentSummaryCache[cacheKey] = { data: responseData, timestamp: now };
    delete activeAgentLocks[cacheKey];

    return NextResponse.json(responseData);

  } catch (error) { 
      delete activeAgentLocks[cacheKey]; 
      return NextResponse.json({ success: false }); 
  }
}