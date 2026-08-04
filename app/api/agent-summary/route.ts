import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // 💥 Stop Next.js Aggressive Caching 💥

let agentSummaryCache: Record<string, { data: any, timestamp: number }> = {};
let activeAgentLocks: Record<string, boolean> = {}; 
const CACHE_DURATION = 15 * 1000; 

// 💥 BOSS UPGRADE: REGEX ESCAPER 💥
const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// 💥 BOSS UPGRADE: DYNAMIC STAR & SPACE PRESERVER ENGINE 💥
const applyMasking = (text: string, keywords: string[]) => {
    if (!text) return text;
    let masked = text;
    keywords.forEach(w => {
        const word = w.trim();
        if (word && word.length > 1) {
            const regex = new RegExp(escapeRegExp(word), 'gi');
            masked = masked.replace(regex, (match) => {
                return match.replace(/[^\s]/g, '*');
            });
        }
    });
    return masked;
};

// 💥 THE BOSS FIX: DYNAMIC SERVICE EXTRACTOR 💥
const extractServiceName = (msg: string) => {
    if (!msg) return "Other";

    const serviceMatch = msg.match(/\[Service:\s*([^\]]+)\]/i);
    if (serviceMatch && serviceMatch[1]) {
        return serviceMatch[1].trim(); 
    }

    const lowerMsg = msg.toLowerCase();
    if (lowerMsg.includes('whatsapp') || lowerMsg.includes(' wa ') || lowerMsg.includes('vwaq')) return 'WhatsApp';
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
    if (lowerMsg.includes('uber') || lowerMsg.includes('airbnb')) return 'Uber';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    if (lowerMsg.includes('imo')) return 'IMO';
    if (lowerMsg.includes('viber')) return 'Viber';

    return "Other"; 
};

// STRICT UTC
const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const getUTCHour = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).getUTCHours(); } 
  catch(e) { return 0; }
};

export async function POST(req: Request) {
  const noCacheHeaders = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0"
  };

  const body = await req.json().catch(() => ({}));
  const { email, limitDays = 60 } = body;
  if (!email) return NextResponse.json({ success: false, message: "Email required" }, { headers: noCacheHeaders });

  const safeAgentEmail = email.toLowerCase().trim();
  const cacheKey = `agent_v7_exact_inactive_${safeAgentEmail}_${limitDays}`;
  const now = Date.now();

  try {
    if (agentSummaryCache[cacheKey] && (now - agentSummaryCache[cacheKey].timestamp < CACHE_DURATION)) {
        return NextResponse.json(agentSummaryCache[cacheKey].data, { headers: noCacheHeaders });
    }

    if (activeAgentLocks[cacheKey] && agentSummaryCache[cacheKey]) {
        return NextResponse.json(agentSummaryCache[cacheKey].data, { headers: noCacheHeaders }); 
    }

    activeAgentLocks[cacheKey] = true;
    await connectToDatabase();

    // 💥 FETCH SECRET MASKING KEYWORDS FROM DB 💥
    const settingsCollection = mongoose.connection.collection("system_settings");
    const sysSettings = await settingsCollection.findOne({ type: "global" });
    const hiddenKeywords = sysSettings?.hiddenKeywords || [];

    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') }).lean();
    if (!agent) {
        delete activeAgentLocks[cacheKey];
        return NextResponse.json({ success: false, message: "Agent not found" }, { headers: noCacheHeaders });
    }

    const exactAgentEmail = agent.email;
    const customAgentEmail = agent.customAgentMail;
    
    const agentEmailArray = [exactAgentEmail];
    if (customAgentEmail) agentEmailArray.push(customAgentEmail);

    const networkUsers = await User.find({ 
        agentEmail: { $in: agentEmailArray }, 
        role: "user",
        $or: [
          { status: "active" },
          { status: { $exists: false } },
          { status: "" }
        ]
    })
    .select("email otpRate fullName uid _id lastLogin updatedAt createdAt activeSessions balance status")
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
              sName = applyMasking(sName, hiddenKeywords); // 💥 BOSS UPGRADE: MASK SERVICE NAME
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
    
    const inactiveUsersArr = networkUsers.map((u: any) => {
        const createdTime = new Date(u.createdAt || nowTime).getTime();
        
        let referenceTime = createdTime;
        if (u.lastLogin) {
            referenceTime = new Date(u.lastLogin).getTime();
        } else if (u.activeSessions && u.activeSessions.length > 0 && u.updatedAt) {
            referenceTime = new Date(u.updatedAt).getTime();
        }

        const sortValue = referenceTime; 
        const diffDays = Math.floor((nowTime - referenceTime) / (1000 * 60 * 60 * 24));
        
        let timeText = ""; 
        if (u.lastLogin || (u.activeSessions && u.activeSessions.length > 0)) {
            if (diffDays === 0) timeText = "Today";
            else if (diffDays === 1) timeText = "Yesterday";
            else timeText = `${diffDays} days ago`;
        } else {
            if (diffDays === 0) timeText = "Never (Created Today)";
            else timeText = `Never (${diffDays}d ago)`;
        }
        
        return {
            id: u.uid || `ZX-${u._id?.toString().substring(18, 24).toUpperCase() || 'UNKNOWN'}`,
            email: u.email,
            name: u.fullName || u.email.split('@')[0],
            inactiveText: timeText, 
            balance: u.balance || 0, 
            sortValue
        };
    })
    .sort((a, b) => a.sortValue - b.sortValue)
    .slice(0, 20);

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

    return NextResponse.json(responseData, { headers: noCacheHeaders });

  } catch (error) { 
      delete activeAgentLocks[cacheKey]; 
      return NextResponse.json({ success: false }, { headers: noCacheHeaders }); 
  }
}