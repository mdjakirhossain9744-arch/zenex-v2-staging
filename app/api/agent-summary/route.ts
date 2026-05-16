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

// 🔥 SAFE IN-MEMORY CACHES 🔥
let cachedKeywords: string[] = [];
let lastKeywordFetchTime = 0;
const CACHE_TTL = 60 * 1000;

const getHiddenKeywordsFromCache = async () => {
    if (Date.now() - lastKeywordFetchTime < CACHE_TTL) return cachedKeywords;
    try {
        const settings = await Setting.findOne({}).lean();
        cachedKeywords = (settings?.hiddenKeywords || []).map((k: string) => k.toLowerCase());
        lastKeywordFetchTime = Date.now();
    } catch (e) {}
    return cachedKeywords;
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
    const { email } = await req.json();
    const safeAgentEmail = email.toLowerCase().trim();

    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') }).lean();
    if (!agent) return NextResponse.json({ success: false, message: "Agent not found" });

    const hiddenKeywords = await getHiddenKeywordsFromCache();

    const emailConditions = [{ agentEmail: new RegExp(`^${agent.email}$`, 'i') }];
    if (agent.customAgentMail) emailConditions.push({ agentEmail: new RegExp(`^${agent.customAgentMail}$`, 'i') });

    const networkUsers = await User.find({ $or: emailConditions, role: "user" })
      .select("email otpRate fullName uid _id lastLogin createdAt")
      .lean();

    const targetEmails = new Set<string>();
    const userRateMap: Record<string, number> = {};
    const userInfoMap: Record<string, any> = {}; 

    targetEmails.add(safeAgentEmail);
    if (agent.customAgentMail) targetEmails.add(agent.customAgentMail.toLowerCase().trim());
    userRateMap[safeAgentEmail] = agent.otpRate || 0.50;

    networkUsers.forEach((u: any) => {
        if (u.email) {
            const e = u.email.toLowerCase().trim();
            targetEmails.add(e);
            userRateMap[e] = u.otpRate || 0.50;
            userInfoMap[e] = {
                id: u.uid || `ZX-${u._id?.toString().substring(18, 24).toUpperCase() || 'UNKNOWN'}`,
                name: u.fullName || u.email.split('@')[0],
                todayOTP: 0 
            };
        }
    });

    const uniqueEmails = Array.from(targetEmails);
    const agentMaxRate = agent.agentMaxRate || 0.70;

    const queryConditions: any[] = [];
    uniqueEmails.forEach(e => {
        const regex = new RegExp(`^${e}$`, 'i');
        queryConditions.push({ userEmail: regex }, { email: regex });
    });

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60);

    const groupedRawData: Record<string, any> = {};
    const archivedKeys = new Set<string>();

    const dailyStats = await DailyStat.find({ dateString: { $gte: getUTCDateString(sixtyDaysAgo) }, $or: queryConditions }).lean();
    
    dailyStats.forEach((ds: any) => {
        const dDate = ds.dateString;
        const dEmail = (ds.userEmail || "").toLowerCase().trim();
        
        archivedKeys.add(`${dDate}_${dEmail}`);

        if (!groupedRawData[dDate]) groupedRawData[dDate] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };

        groupedRawData[dDate].total += (ds.totalNumbers || 0);
        groupedRawData[dDate].allocation += (ds.totalNumbers || 0);
        groupedRawData[dDate].success += (ds.successOTP || 0);
        groupedRawData[dDate].failed += (ds.failedNumbers || ds.failed || 0); 

        const uRate = userRateMap[dEmail] || 0.50;
        groupedRawData[dDate].amount += Math.max(0, agentMaxRate - uRate) * (ds.successOTP || 0);
    });

    const orders = await Order.find({ createdAt: { $gte: sixtyDaysAgo }, $or: queryConditions })
    .select("status createdAt updatedAt dateString fullMessage userEmail email")
    .lean(); 

    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];
    const todayStrUTC = getUTCDateString(new Date());

    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 

       let finalDateStr = "";
       if ((currentStatus === "DONE" || currentStatus === "SUCCESS") && o.updatedAt) {
           finalDateStr = getUTCDateString(o.updatedAt);
       } else if (o.createdAt) {
           finalDateStr = getUTCDateString(o.createdAt);
       } else if (o.dateString) {
           finalDateStr = getUTCDateString(new Date(o.dateString));
       } else {
           finalDateStr = getUTCDateString(new Date());
       }

       const safeUserEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       if (finalDateStr !== todayStrUTC && archivedKeys.has(`${finalDateStr}_${safeUserEmail}`)) return;

       if (!groupedRawData[finalDateStr]) {
           groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       }
       
       groupedRawData[finalDateStr].total += 1;
       groupedRawData[finalDateStr].allocation += 1;

       if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
          const msgLower = (o.fullMessage || "").toLowerCase();
          const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

          const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
          const uniqueCodes = new Set();
          msgArray.forEach((msg: string) => {
              const match = msg.match(/\b\d{4,8}\b/);
              uniqueCodes.add(match ? match[0] : msg.trim());
          });
          const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

          groupedRawData[finalDateStr].success += validMsgCount;
          
          if (!isFreeService) {
              const uRate = userRateMap[safeUserEmail] || 0.50;
              groupedRawData[finalDateStr].amount += Math.max(0, agentMaxRate - uRate) * validMsgCount;
          }

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += validMsgCount;

              if (userInfoMap[safeUserEmail]) userInfoMap[safeUserEmail].todayOTP += validMsgCount;

              let sName = extractServiceName(o.fullMessage);

              hiddenKeywords.forEach((kw: string) => {
                  if (kw && sName.toLowerCase().includes(kw.trim())) {
                      sName = "******";
                  }
              });

              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += validMsgCount;
          }
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
           groupedRawData[finalDateStr].failed += 1;
       }
    });

    const topPerformersArr = Object.values(userInfoMap)
       .map((u: any) => ({ id: u.id, name: u.name, otpCount: u.todayOTP }))
       .filter(u => u.otpCount > 0).sort((a, b) => b.otpCount - a.otpCount).slice(0, 15); 

    const inactiveUsersArr = networkUsers.map((u: any) => ({
        id: u.uid || `ZX-${u._id?.toString().substring(18, 24).toUpperCase() || 'UNKNOWN'}`,
        name: u.fullName || u.email.split('@')[0],
        lastLogin: u.lastLogin || null,
    }))
    .sort((a, b) => {
        if (!a.lastLogin && !b.lastLogin) return 0;
        if (!a.lastLogin) return -1; 
        if (!b.lastLogin) return 1;
        return new Date(a.lastLogin).getTime() - new Date(b.lastLogin).getTime();
    }).slice(0, 10); 

    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const todayData = groupedRawData[todayStrUTC] || { success: 0, amount: 0 };
    const yesterdayData = groupedRawData[yesterdayStrUTC] || { success: 0, amount: 0 };

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate: agentMaxRate, balance: agent.agentEarning || 0, serverDate: todayStrUTC,
       topPerformers: topPerformersArr, inactiveUsers: inactiveUsersArr,
       todaySuccess: todayData.success, todayRevenue: todayData.amount, 
       yesterdaySuccess: yesterdayData.success, yesterdayRevenue: yesterdayData.amount
    });
  } catch (error) { return NextResponse.json({ success: false }); }
}