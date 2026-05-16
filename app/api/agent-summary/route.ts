import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";
import Setting from "../../../models/Setting";

export const dynamic = "force-dynamic";

const STOP_WORDS = new Set([
    'your', 'code', 'otp', 'verification', 'verify', 'use', 'not', 'share', 'this', 
    'pin', 'msg', 'message', 'please', 'password', 'security', 'account', 'login', 
    'from', 'with', 'anyone', 'number', 'secret', 'valid', 'auth', 'authentication', 
    'never', 'give', 'out', 'only', 'http', 'https', 'www', 'com', 'net', 'org', 
    'info', 'sms', 'reply', 'stop', 'the', 'and', 'for',
    'kode', 'rahasia', 'anda', 'adalah', 'jangan', 'berikan', 'kepada', 'siapapun', 
    'untuk', 'masuk', 'silakan', 'kasih', 'yang', 'dari', 'ini', 'kami',
    'codigo', 'compartas', 'para', 'nadie', 'cuenta', 'este', 'seguridad', 'sua', 
    'nao', 'con', 'los', 'las', 'por', 'que', 'digo',
    'votre', 'partager', 'pour', 'compte', 'est', 'jou', 'nin'
]);

const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const lowerMsg = msg.toLowerCase();
    
    if (lowerMsg.includes('whatsapp')) return 'WhatsApp';
    if (lowerMsg.includes('telegram') || lowerMsg.includes('t.me')) return 'Telegram';
    if (lowerMsg.includes('facebook') || lowerMsg.includes(' fb ')) return 'Facebook';
    if (lowerMsg.includes('instagram') || lowerMsg.includes(' ig ')) return 'Instagram';
    if (lowerMsg.includes('google') || /g-\d+/.test(lowerMsg)) return 'Google';
    if (lowerMsg.includes('microsoft')) return 'Microsoft';
    if (lowerMsg.includes('amazon')) return 'Amazon';
    if (lowerMsg.includes('netflix')) return 'Netflix';
    if (lowerMsg.includes('paypal')) return 'PayPal';
    if (lowerMsg.includes('tiktok')) return 'TikTok';
    if (lowerMsg.includes('tinder')) return 'Tinder';
    if (lowerMsg.includes('uber')) return 'Uber';
    if (lowerMsg.includes('twitter') || lowerMsg.includes(' x ')) return 'Twitter/X';
    if (lowerMsg.includes('snapchat')) return 'Snapchat';
    if (lowerMsg.includes('discord')) return 'Discord';
    if (lowerMsg.includes('airbnb')) return 'Airbnb';
    if (lowerMsg.includes('line')) return 'LINE';
    if (lowerMsg.includes('wechat')) return 'WeChat';

    const words = msg.match(/[a-zA-Z]+/g) || [];
    for (let w of words) {
        const wordLower = w.toLowerCase();
        if (wordLower.length > 3 && !STOP_WORDS.has(wordLower)) {
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }
    }
    return "Other";
};

let cachedKeywords: string[] = [];
let lastKeywordFetchTime = 0;
const CACHE_TTL = 60 * 1000;

const getHiddenKeywordsFromCache = async () => {
    if (Date.now() - lastKeywordFetchTime < CACHE_TTL) return cachedKeywords;
    try {
        const settings = await Setting.findOne({}).lean();
        let rawKeys: string[] = [];
        if (settings?.hiddenKeywords) {
            if (Array.isArray(settings.hiddenKeywords)) {
                rawKeys = settings.hiddenKeywords;
            } else if (typeof settings.hiddenKeywords === 'string') {
                rawKeys = (settings.hiddenKeywords as string).split(',');
            }
        }
        cachedKeywords = rawKeys.map((k: string) => k.toLowerCase().trim()).filter(Boolean);
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
    
    const { email, limitDays = 60 } = await req.json();
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

    const isAllTime = limitDays === "all";
    const dailyStatQuery: any = {};

    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit) };
    }

    const queryConditions: any[] = [];
    uniqueEmails.forEach(e => {
        const regex = new RegExp(`^${e}$`, 'i');
        queryConditions.push({ userEmail: regex }, { email: regex });
    });

    if (queryConditions.length > 0) {
        dailyStatQuery.$or = queryConditions;
    }

    const groupedRawData: Record<string, any> = {};
    const archivedKeys = new Set<string>();

    // 1. Fetch EVERYTHING from Diary
    const dailyStats = await DailyStat.find(dailyStatQuery).lean();
    
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

    // 2. 🔥 ULTIMATE OOM PROTECTION: Fetch ONLY the last 3 days from LIVE Orders! 🔥
    const orderQuery: any = {};
    const recentLimit = new Date();
    recentLimit.setUTCDate(recentLimit.getUTCDate() - 3);
    orderQuery.createdAt = { $gte: recentLimit };
    
    if (queryConditions.length > 0) {
        orderQuery.$or = queryConditions;
    }

    const orders = await Order.find(orderQuery).select("status createdAt updatedAt dateString fullMessage userEmail email").lean(); 

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

       // 💥 SKIP if already covered by the Diary
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