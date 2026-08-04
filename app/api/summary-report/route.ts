import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

// 💥 THE BOSS FIX: MASTER SERVICE EXTRACTOR (Added Meta & X) 💥
const extractServiceName = (msg: string) => {
    if (!msg) return "Other";
    const text = msg.toLowerCase();

    if (text.includes("meta")) return "Meta";
    if (text.includes("w5eue21qadh") || text.includes("imo")) return "IMO";
    if (text.includes("ftptmjpdh") || text.includes("viber")) return "Viber";
    if (text.includes('lalamove')) return 'Lalamove'; 
    if (text.includes('whatsapp') || text.includes(' wa ') || text.includes('vwaq')) return 'WhatsApp';
    if (text.includes('telegram') || text.includes('t.me')) return 'Telegram';
    if (text.includes('facebook') || text.includes(' fb ') || text.includes('facebk')) return 'Facebook';
    if (text.includes('instagram') || text.includes(' ig ')) return 'Instagram';
    if (text.includes('google') || /g-\d+/.test(text) || text.includes('gmail') || text.includes('youtube')) return 'Google';
    if (text.includes('tiktok') || text.includes(' tt ')) return 'TikTok';
    if (text.includes('snapchat')) return 'Snapchat';
    if (text.includes('twitter') || text.includes(' x ') || text.includes('for x')) return 'X';
    if (text.includes('apple') || text.includes('icloud')) return 'Apple';
    if (text.includes('microsoft') || text.includes('live') || text.includes('outlook')) return 'Microsoft';
    if (text.includes('amazon') || text.includes('prime')) return 'Amazon';
    if (text.includes('netflix')) return 'Netflix';
    if (text.includes('uber')) return 'Uber';
    if (text.includes('paypal') || text.includes('pay pal')) return 'PayPal';
    if (text.includes('cashapp') || text.includes('cash app')) return 'CashApp';
    if (text.includes('venmo')) return 'Venmo';
    if (text.includes('tinder')) return 'Tinder';
    if (text.includes('bumble')) return 'Bumble';
    if (text.includes('discord')) return 'Discord';
    if (text.includes('twitch')) return 'Twitch';
    if (text.includes('yahoo')) return 'Yahoo';
    if (text.includes('wechat')) return 'WeChat';
    if (text.includes('line')) return 'Line';
    if (text.includes('kakaotalk')) return 'KakaoTalk';
    if (text.includes('airbnb')) return 'Uber/Airbnb'; 
    if (text.includes('binance')) return 'Binance';
    if (text.includes('coinbase')) return 'Coinbase';
    if (text.includes('kucoin')) return 'KuCoin';
    if (text.includes('kraken')) return 'KuCoin/Kraken';
    if (text.includes('epic games')) return 'Epic Games';
    if (text.includes('steam')) return 'Steam';
    if (text.includes('riot')) return 'Riot Games';
    if (text.includes('daraz')) return 'Daraz';
    if (text.includes('pathao')) return 'Pathao';
    if (text.includes('foodpanda')) return 'Foodpanda';

    const bracketMatch = msg.match(/(?:<|\[|【|\x1B<)\s*([A-Za-z0-9.\- ]{2,20})\s*(?:>|\]|】|\x1B>)/);
    if (bracketMatch && bracketMatch[1]) {
        const extracted = bracketMatch[1].trim();
        const ignored = ["#", "code", "reply", "sms", "otp", "msg", "verification"];
        if (!ignored.includes(extracted.toLowerCase())) {
            return extracted.charAt(0).toUpperCase() + extracted.slice(1);
        }
    }

    const opMatch = msg.match(/(?:operating on|code for|from)\s+([A-Za-z0-9.\-]{2,20})\b/i);
    if (opMatch && opMatch[1]) {
        const ext = opMatch[1].trim();
        const ignored = ["the", "a", "an", "your", "this"];
        if (!ignored.includes(ext.toLowerCase())) {
            return ext.charAt(0).toUpperCase() + ext.slice(1);
        }
    }

    return "Other"; 
};

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    const { email, limitDays = 60 } = await req.json();
    const safeEmail = email.toLowerCase().trim();

    const currentUser = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') }).lean();
    if (!currentUser) return NextResponse.json({ success: false });

    const exactDbEmail = currentUser.email; 
    let userRate = currentUser.otpRate || 0;
    let balance = currentUser.balance || 0;
    
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
    
    const dailyStatQuery: any = { dateString: { $lt: liveQueryDateStr }, userEmail: exactDbEmail };
    
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date();
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: liveQueryDateStr };
    }

    const orderQuery: any = { dateString: { $gte: liveQueryDateStr }, userEmail: exactDbEmail }; 

    // 💥 USER MATH: Cost Only (No Commission) + processedKeys injected 💥
    const [dailyStatsAgg, orders] = await Promise.all([
        DailyStat.aggregate([
            { $match: dailyStatQuery },
            { $group: {
                _id: "$dateString",
                total: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
                success: { $sum: { $ifNull: ["$successOTP", 0] } },
                failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } },
                amount: { $sum: { $ifNull: ["$totalCost", 0] } }
            }}
        ]),
        Order.find(orderQuery).select("status dateString createdAt updatedAt fullMessage orderCost processedKeys").lean()
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    // 🔥 Total Fix Logic Applied
    dailyStatsAgg.forEach((ds: any) => {
        let finalTotal = ds.total || ds.allocation || 0;
        if (finalTotal === 0 && (ds.success > 0 || ds.failed > 0)) {
            finalTotal = ds.success + ds.failed;
        }
        groupedRawData[ds._id] = { total: finalTotal, allocation: finalTotal, success: ds.success, failed: ds.failed, amount: ds.amount };
    });

    orders.forEach((o: any) => {
       const currentStatus = (o.status || "").toUpperCase(); 
       const finalDateStr = o.dateString || getUTCDateString(o.createdAt);
       if (finalDateStr < liveQueryDateStr) return; 

       if (!groupedRawData[finalDateStr]) groupedRawData[finalDateStr] = { total: 0, success: 0, failed: 0, amount: 0, allocation: 0 };
       groupedRawData[finalDateStr].total += 1; groupedRawData[finalDateStr].allocation += 1;

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
          groupedRawData[finalDateStr].amount += (o.orderCost || 0); // User only sees their earnings

          if (finalDateStr === todayStrUTC) {
              const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
              const bIdx = Math.floor(hour / 4);
              if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

              let sName = extractServiceName(o.fullMessage);
              if (!todayAppCounts[sName]) todayAppCounts[sName] = 0;
              todayAppCounts[sName] += exactValidCount;
          }
       } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING", "ACTIVE", "READY", ""].includes(currentStatus)) {
          groupedRawData[finalDateStr].failed += 1;
       }
    });

    const yesterdayDate = new Date(); yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    return NextResponse.json({
       success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
       userRate, balance, serverDate: todayStrUTC,
       todaySuccess: todayData.success, todaySpend: todayData.amount, // Note: Variable kept 'todaySpend' for UI compatibility, but represents User Earnings
       yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    });

  } catch (error) { return NextResponse.json({ success: false }); }
}