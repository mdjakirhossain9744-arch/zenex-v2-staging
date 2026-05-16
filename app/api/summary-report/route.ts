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
let cachedAdminCostMap: Record<string, number> = {};
let lastCostMapFetchTime = 0;
const CACHE_TTL = 60 * 1000;

// 🔥 ULTRA-RESILIENT KEYWORD FETCHING (String & Array both supported) 🔥
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

// 💥 STRICT UTC TIMEZONE 💥
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
    
    const { email, role, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    const [hiddenKeywords, userToAdminCostMap] = (await Promise.all([
        getHiddenKeywordsFromCache(),
        role === "admin" ? getAdminCostMapFromCache() : Promise.resolve({})
    ])) as [string[], Record<string, number>];

    let userRate = role === "admin" ? 0 : (currentUser.otpRate || 0.50);
    let balance = role === "admin" ? 0 : (currentUser.balance || 0);
    let targetEmail = role === "admin" ? "" : safeEmail;

    const isAllTime = limitDays === "all";
    const dailyStatQuery: any = {};
    const orderQuery: any = {};

    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit) };
        orderQuery.createdAt = { $gte: pastDaysLimit };
    }

    if (role !== "admin") {
        dailyStatQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
        orderQuery.userEmail = new RegExp(`^${targetEmail}$`, 'i');
    }

    const todayStrUTC = getUTCDateString(new Date());
    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];
    
    const dailyStats = await DailyStat.find(dailyStatQuery).lean();
    const archivedKeys = new Set<string>();

    dailyStats.forEach((ds: any) => {
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

    const orders = await Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage userEmail").lean();

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

       const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       if (finalDateStr !== todayStrUTC && archivedKeys.has(`${finalDateStr}_${uEmail}`)) return; 

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

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += validMsgCount;

              let sName = extractServiceName(o.fullMessage);
              
              // 🔥 SECRET MASKING LOGIC RUNS HERE 🔥
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