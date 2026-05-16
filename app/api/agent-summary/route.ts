import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";
import Setting from "../../../models/Setting";

export const dynamic = "force-dynamic";

// 🔥 GLOBAL OPTIMIZATIONS 🔥
const STOP_WORDS = new Set(['your', 'is', 'code', 'the', 'otp', 'verification', 'verify', 'for', 'to', 'use', 'do', 'not', 'share', 'this', 'pin', 'msg', 'message', 'please', 'password', 'security', 'account', 'login', 'and', 'from', 'g', 'v']);

const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const words = msg.match(/[a-zA-Z]+/g) || [];
    for (let w of words) {
        if (w.length > 2 && !STOP_WORDS.has(w.toLowerCase())) {
            return w.charAt(0).toUpperCase() + w.slice(1);
        }
    }
    return "Other";
};

// 🔥 IN-MEMORY RAM CACHES 🔥
let cachedKeywords: string[] = [];
let lastKeywordFetchTime = 0;

let cachedAdminCostMap: Record<string, number> = {};
let lastCostMapFetchTime = 0;

const CACHE_TTL = 60 * 1000;

// 🔥 SMART HISTORICAL CACHE (PAST DAYS DATA NEVER CHANGES) 🔥
const historicalCache = new Map<string, { dateStr: string, pastData: Record<string, any>, archivedKeys: Set<string> }>();

const getHiddenKeywordsFromCache = async () => {
    if (Date.now() - lastKeywordFetchTime < CACHE_TTL) return cachedKeywords;
    try {
        const settings = await Setting.findOne({}).lean();
        cachedKeywords = (settings?.hiddenKeywords || []).map((k: string) => k.toLowerCase());
        lastKeywordFetchTime = Date.now();
    } catch (e) {}
    return cachedKeywords;
};

const getAdminCostMapFromCache = async () => {
    if (Date.now() - lastCostMapFetchTime < CACHE_TTL && Object.keys(cachedAdminCostMap).length > 0) return cachedAdminCostMap;
    try {
        const allUsers = await User.find({}).select("email agentEmail role agentMaxRate customAgentMail").lean();
        const agentRates: Record<string, number> = {};
        const newCostMap: Record<string, number> = {};
        allUsers.forEach((u: any) => {
            if (u.role === "agent") {
                const rate = u.agentMaxRate || 0;
                if (u.email) agentRates[u.email.toLowerCase().trim()] = rate;
                if (u.customAgentMail) agentRates[u.customAgentMail.toLowerCase().trim()] = rate;
            }
        });
        allUsers.forEach((u: any) => {
            if (u.email) {
                const emailKey = u.email.toLowerCase().trim();
                if (u.role === "agent") newCostMap[emailKey] = agentRates[emailKey] || 0;
                else if (u.role === "user" && u.agentEmail) {
                    const aEmail = u.agentEmail.toLowerCase().trim();
                    newCostMap[emailKey] = agentRates[aEmail] || 0;
                }
            }
        });
        cachedAdminCostMap = newCostMap;
        lastCostMapFetchTime = Date.now();
    } catch (e) {}
    return cachedAdminCostMap;
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
  try {
    await connectToDatabase();
    const { email, role } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    // 🔥 TYPE ERROR FIXED HERE (as [string[], Record<string, number>]) 🔥
    const [hiddenKeywords, userToAdminCostMap] = (await Promise.all([
        getHiddenKeywordsFromCache(),
        role === "admin" ? getAdminCostMapFromCache() : Promise.resolve({})
    ])) as [string[], Record<string, number>];

    let userRate = role === "admin" ? 0 : (currentUser.otpRate || 0.50);
    let balance = role === "admin" ? 0 : (currentUser.balance || 0);
    let targetEmail = role === "admin" ? "" : safeEmail;

    const todayStrUTC = getUTCDateString(new Date());
    const cacheKey = `${role}_${targetEmail}`;
    
    let groupedRawData: Record<string, any> = {};
    let archivedKeys = new Set<string>();

    // 🔥 SMART CACHE LOGIC: Fetch Past Data from RAM if Date matches Today 🔥
    if (historicalCache.has(cacheKey) && historicalCache.get(cacheKey)!.dateStr === todayStrUTC) {
        const cached = historicalCache.get(cacheKey)!;
        groupedRawData = JSON.parse(JSON.stringify(cached.pastData)); // Deep Copy
        archivedKeys = new Set(cached.archivedKeys);
    } else {
        // No Cache or Date Changed: Fetch Past Data from DB & Save to Cache
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

        const dailyStatQuery: any = { dateString: { $gte: getUTCDateString(sixtyDaysAgo), $lt: todayStrUTC } }; // Fetch only before today
        if (role !== "admin") dailyStatQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
        
        const pastDailyStats = await DailyStat.find(dailyStatQuery).lean();

        pastDailyStats.forEach((ds: any) => {
            const dDate = ds.dateString;
            const dEmail = (ds.userEmail || "").toLowerCase().trim();
            archivedKeys.add(`${dDate}_${dEmail}`);
            if (!groupedRawData[dDate]) groupedRawData[dDate] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
            groupedRawData[dDate].total += (ds.totalNumbers || 0);
            groupedRawData[dDate].allocation += (ds.totalNumbers || 0);
            groupedRawData[dDate].success += (ds.successOTP || 0);
            groupedRawData[dDate].failed += (ds.failedNumbers || ds.failed || 0); 
            let orderCostRate = role === "admin" ? (userToAdminCostMap[dEmail] || 0) : userRate;
            groupedRawData[dDate].amount += (orderCostRate * (ds.successOTP || 0));
        });

        historicalCache.set(cacheKey, { dateStr: todayStrUTC, pastData: JSON.parse(JSON.stringify(groupedRawData)), archivedKeys });
    }

    // 🔥 LIVE QUERY: Fetch ONLY Today's Orders from DB 🔥
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    const todayQuery: any = { dateString: todayStrUTC }; // Only Today's Data
    if (role !== "admin") todayQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');

    const liveOrders = await Order.find(todayQuery).select("status dateString createdAt updatedAt fullMessage userEmail").lean();

    liveOrders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 
       let finalDateStr = todayStrUTC;
       const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       
       const msgLower = (o.fullMessage || "").toLowerCase();
       const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

       groupedRawData[finalDateStr].total += 1; 
       groupedRawData[finalDateStr].allocation += 1;

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
          const uniqueCodes = new Set();
          msgArray.forEach((msg: string) => {
              const match = msg.match(/\b\d{4,8}\b/);
              uniqueCodes.add(match ? match[0] : msg.trim());
          });
          const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

          groupedRawData[finalDateStr].success += validMsgCount;
          let orderCostRate = role === "admin" ? (userToAdminCostMap[uEmail] || 0) : userRate;
          if (!isFreeService) groupedRawData[finalDateStr].amount += (orderCostRate * validMsgCount);

          const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
          const bIdx = Math.floor(hour / 4);
          if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += validMsgCount;

          let sName = extractServiceName(o.fullMessage);
          
          hiddenKeywords.forEach((kw: string) => {
              if (kw && sName.toLowerCase().includes(kw.trim())) {
                  sName = "******";
              }
          });
          
          if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
          todayAppCounts[sName] += validMsgCount;
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const todayData = groupedRawData[todayStrUTC] || { success: 0, amount: 0 };
    const yesterdayData = groupedRawData[yesterdayStrUTC] || { success: 0, amount: 0 };

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrUTC,
       todaySuccess: todayData.success, todaySpend: todayData.amount, 
       yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}