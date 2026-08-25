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

// 💥 CRITICAL OPTIMIZATION: Removed legacy `extractServiceName` Regex Engine 💥

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

    // 💥 FETCH SECRET MASKING KEYWORDS FROM DB (Removed heavy dynamicServices fetch) 💥
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

    // 💥 THE GREAT USDT MIGRATION: 4-Decimal Precision 💥
    const agentMaxRate = Number((agent.agentMaxRate || 0.0000).toFixed(4));
    
    const todayStrUTC = getUTCDateString(new Date());

    // 💥 SMART DATE FIREWALL: Prevent DDOS & Full Table Scans 💥
    const accountAgeMs = Date.now() - new Date(agent.createdAt || Date.now()).getTime();
    const accountAgeDays = Math.max(1, Math.ceil(accountAgeMs / (1000 * 60 * 60 * 24)));
    
    let safeLimitNum = 60;
    if (limitDays === "all") {
        safeLimitNum = Math.min(accountAgeDays, 365);
    } else {
        let parsedDays = Number(limitDays);
        if (isNaN(parsedDays) || parsedDays < 1) parsedDays = 7; 
        if (parsedDays > accountAgeDays) parsedDays = accountAgeDays; 
        if (parsedDays > 365) parsedDays = 365; 
        safeLimitNum = parsedDays;
    }

    // Force isAllTime to false to ensure DB bounded query
    const isAllTime = false; 
    
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
        const limitNum = safeLimitNum; // 💥 Firewalled limit applied here 💥
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
        // 💥 THE GREAT USDT MIGRATION: Past Data 4-Decimal 💥
        groupedRawData[ds._id] = {
            total: finalTotal, allocation: finalTotal,
            success: ds.success, failed: ds.failed, 
            amount: Number((ds.amount || 0).toFixed(4))
        };
    });
    
    // 💥 V2 ULTRA-FAST AGGREGATION: Added trueService to cursor select 💥
    const ordersCursor = Order.find(orderQuery)
        .select("status createdAt updatedAt dateString fullMessage userEmail email orderCommission processedKeys trueService")
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
          
          // 💥 THE GREAT USDT MIGRATION: Prevents Javascript Floating-Point Math Errors 💥
          groupedRawData[finalDateStr].amount = Number((groupedRawData[finalDateStr].amount + (o.orderCommission || 0)).toFixed(4));

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

              if (userInfoMap[safeUserEmail]) userInfoMap[safeUserEmail].todayOTP += exactValidCount;

              // 💥 V2 ULTRA-FAST AGGREGATION: Direct DB Service Field (O(1) Access) 💥
              let sName = (o.trueService && o.trueService !== "Unknown") ? o.trueService : "Other";
              sName = applyMasking(sName, hiddenKeywords); // 💥 MASK SERVICE NAME IF IN HIDDEN LIST 💥
              
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
            balance: Number((u.balance || 0).toFixed(4)), // 💥 THE GREAT USDT MIGRATION: 4-Decimal Balance 💥
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
       userRate: agentMaxRate, 
       balance: Number((agent.agentEarning || 0).toFixed(4)), // 💥 THE GREAT USDT MIGRATION 💥
       serverDate: todayStrUTC,
       topPerformers: topPerformersArr, 
       inactiveUsers: inactiveUsersArr,
       todaySuccess: todayData.success, 
       todayRevenue: Number((todayData.amount || 0).toFixed(4)), // 💥 THE GREAT USDT MIGRATION 💥
       yesterdaySuccess: yesterdayData.success, 
       yesterdayRevenue: Number((yesterdayData.amount || 0).toFixed(4)) // 💥 THE GREAT USDT MIGRATION 💥
    };

    agentSummaryCache[cacheKey] = { data: responseData, timestamp: now };
    delete activeAgentLocks[cacheKey];

    return NextResponse.json(responseData, { headers: noCacheHeaders });

  } catch (error) { 
      delete activeAgentLocks[cacheKey]; 
      return NextResponse.json({ success: false }, { headers: noCacheHeaders }); 
  }
}