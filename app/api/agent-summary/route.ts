import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

// 💥 15-SECOND MICRO-CACHE MECHANISM (ZERO DB LOAD) 💥
const cache = new Map<string, { timestamp: number, data: any }>();
const CACHE_DURATION = 15000; // 15 seconds

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
  try {
    const body = await req.json();
    const { email, limitDays = 60 } = body;
    const safeAgentEmail = email.toLowerCase().trim();
    const cacheKey = `${safeAgentEmail}_${limitDays}`;

    const now = Date.now();
    const cachedData = cache.get(cacheKey);
    if (cachedData && (now - cachedData.timestamp < CACHE_DURATION)) {
        return NextResponse.json(cachedData.data);
    }

    await connectToDatabase();

    const agent = await User.findOne({ email: new RegExp(`^${safeAgentEmail}$`, 'i') }).lean();
    if (!agent) return NextResponse.json({ success: false, message: "Agent not found" });

    // 💥 GET EXACT DB EMAILS 💥
    const exactAgentEmail = agent.email;
    const customAgentEmail = agent.customAgentMail;
    
    const agentEmailArray = [exactAgentEmail];
    if (customAgentEmail) agentEmailArray.push(customAgentEmail);

    // Fetch network users using Exact Match $in array (Super Fast!)
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
    let liveQueryStart = new Date(todayStrUTC + "T00:00:00.000Z");

    const currentUTCHour = new Date().getUTCHours();
    const currentUTCMin = new Date().getUTCMinutes();
    
    if (currentUTCHour === 0 && currentUTCMin <= 35) {
        const yesterdayDate = new Date();
        yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
        liveQueryDateStr = getUTCDateString(yesterdayDate);
        liveQueryStart = new Date(liveQueryDateStr + "T00:00:00.000Z");
    }

    const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr } };

    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
    }

    // 💥 BYPASS REGEX: Exact Match $in Index Scan (Huge Speed Boost) 💥
    if (exactTargetEmails.length > 0) {
        dailyStatQuery.$or = [
            { userEmail: { $in: exactTargetEmails } },
            { email: { $in: exactTargetEmails } }
        ];
    }

    const groupedRawData: Record<string, any> = {};
    const dailyStats = await DailyStat.find(dailyStatQuery).lean();
    
    dailyStats.forEach((ds: any) => {
        const dDate = ds.dateString;
        if (!groupedRawData[dDate]) groupedRawData[dDate] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };

        groupedRawData[dDate].total += (ds.totalNumbers || 0);
        groupedRawData[dDate].allocation += (ds.totalNumbers || 0);
        groupedRawData[dDate].success += (ds.successOTP || 0);
        groupedRawData[dDate].failed += (ds.failedNumbers || ds.failed || 0); 
        groupedRawData[dDate].amount += (ds.totalCommission || 0);
    });

    const orderQuery: any = { createdAt: { $gte: liveQueryStart } };
    
    if (exactTargetEmails.length > 0) {
        orderQuery.$or = [
            { userEmail: { $in: exactTargetEmails } },
            { email: { $in: exactTargetEmails } }
        ];
    }

    const orders = await Order.find(orderQuery).select("status createdAt updatedAt dateString fullMessage userEmail email orderCommission").lean(); 

    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];
    
    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 
       const finalDateStr = o.dateString || getUTCDateString(o.createdAt);

       if (finalDateStr < liveQueryDateStr) return;

       const safeUserEmail = (o.userEmail || o.email || "").toLowerCase().trim();

       if (!groupedRawData[finalDateStr]) {
           groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       }
       
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
          groupedRawData[finalDateStr].amount += (o.orderCommission || 0);

          if (finalDateStr === todayStrUTC) {
              const hour = getUTCHour(o.updatedAt || o.createdAt || new Date());
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += validMsgCount;

              if (userInfoMap[safeUserEmail]) userInfoMap[safeUserEmail].todayOTP += validMsgCount;

              let sName = extractServiceName(o.fullMessage);
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

    cache.set(cacheKey, { timestamp: now, data: responseData });

    return NextResponse.json(responseData);
  } catch (error) { return NextResponse.json({ success: false }); }
}