import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import DailyStat from "../../../../models/DailyStat";
import redis from "../../../lib/redis"; 

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // 💥 Stop Next.js Aggressive Caching 💥

// 💥 THE BOSS FIX: DYNAMIC SERVICE EXTRACTOR (SYNCED WITH SERVER.JS) 💥
const extractServiceName = (msg: string) => {
    if (!msg) return "Other";

    // 1. Read Exact Tag Injected by Engine-2 AI Scanner (For Old Legacy Data)
    const serviceMatch = msg.match(/\[Service:\s*([^\]]+)\]/i);
    if (serviceMatch && serviceMatch[1]) {
        return serviceMatch[1].trim(); 
    }

    // 2. Comprehensive AI Fallback for Pure Raw Messages
    const text = msg.toLowerCase();
    
    // 💥 UPGRADE 1: GLOBAL SERVICE DETECTION ENGINE (Hashes, Short URLs, Foreign Languages) -> PascalCase 💥
    if (text.includes('facebook') || text.includes(' fb ') || text.includes('facebk') || text.includes('fb.me') || text.includes('h29q+fsn4sr') || text.includes('laz+nxcarlw') || text.includes('فيسبوك') || text.includes('फेसबुक') || text.includes('ফেসবুক') || text.includes('脸书') || text.includes('ፌስቡክ') || text.includes('ფეისბუქი')) return 'Facebook';
    if (text.includes('whatsapp') || text.includes(' wa ') || text.includes('vwaq') || text.includes('wa.me') || text.includes('واتساب') || text.includes('वाट्सएप') || text.includes('হোয়াটসঅ্যাপ') || text.includes('వాట్సాప్') || text.includes('왓츠앱')) return 'WhatsApp';
    if (text.includes('telegram') || text.includes('t.me') || text.includes('تيليجرام') || text.includes('टेलीग्राम') || text.includes('টেলিগ্রাম') || text.includes('телеграм') || text.includes('电报') || text.includes('ቴሌግራም')) return 'Telegram';
    if (text.includes('instagram') || text.includes(' ig ') || text.includes('ig.me') || text.includes('انستجرام') || text.includes('इंस्टाग्राम') || text.includes('ইন্সটাগ্রাম') || text.includes('인스타그램')) return 'Instagram';
    if (text.includes('google') || /g-\d+/.test(text) || text.includes('gmail') || text.includes('youtube') || text.includes('g.co') || text.includes('جوجل') || text.includes('गूगल') || text.includes('গুগল') || text.includes('谷歌') || text.includes('구글') || text.includes('гугл')) return 'Google';
    
    if (text.includes('w5eue21qadh') || text.includes('imo') || text.includes('ايمو') || text.includes('ইমো')) return 'IMO';
    if (text.includes('ftptmjpdh') || text.includes('viber') || text.includes('فايبر') || text.includes('ভাইবার')) return 'Viber';
    
    if (text.includes('meta')) return 'Meta';
    if (text.includes('lalamove')) return 'Lalamove'; 
    if (text.includes('tiktok') || text.includes(' tt ') || text.includes('تيك توك') || text.includes('टिकटॉक') || text.includes('টিকটক') || text.includes('틱톡')) return 'TikTok';
    if (text.includes('snapchat')) return 'Snapchat';
    if (text.includes('twitter') || text.includes(' x ') || text.includes('for x')) return 'X';
    if (text.includes('apple') || text.includes('icloud')) return 'Apple';
    if (text.includes('microsoft') || text.includes('live') || text.includes('outlook')) return 'Microsoft';
    if (text.includes('amazon') || text.includes('prime')) return 'Amazon';
    if (text.includes('netflix')) return 'Netflix';
    if (text.includes('uber') && !text.includes('airbnb')) return 'Uber';
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
    if (text.includes('binance') || text.includes('بینانس') || text.includes('बाइनेंस') || text.includes('বাইনান্স')) return 'Binance';
    if (text.includes('coinbase')) return 'Coinbase';
    if (text.includes('kucoin') && !text.includes('kraken')) return 'KuCoin';
    if (text.includes('kraken')) return 'KuCoin/Kraken';
    if (text.includes('epic games')) return 'Epic Games';
    if (text.includes('steam')) return 'Steam';
    if (text.includes('riot')) return 'Riot Games';
    if (text.includes('daraz')) return 'Daraz';
    if (text.includes('pathao')) return 'Pathao';
    if (text.includes('foodpanda')) return 'Foodpanda';

    return "Other"; 
};

// 💥 STRICT UTC TIMEZONE AS PER BOSS COMMAND 💥
const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

const releaseThread = () => new Promise(resolve => setTimeout(resolve, 0));

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    
    if (Order.collection && DailyStat.collection) {
        Promise.all([
            Order.collection.createIndex({ dateString: 1 }).catch(() => {}),
            DailyStat.collection.createIndex({ dateString: -1 }).catch(() => {})
        ]).catch(() => {});
    }

    const { email, role, limitDays = 60 } = await req.json();

    const noCacheHeaders = {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
    };

    if (role !== "admin") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403, headers: noCacheHeaders });

    const cacheKey = `admin_summary_v3_exact_otp_${limitDays}_UTC`; 
    const cachedData = await redis.get(cacheKey).catch(() => null);

    if (cachedData) {
        let parsedCache;
        try {
            parsedCache = typeof cachedData === "string" ? JSON.parse(cachedData) : cachedData;
            return NextResponse.json(parsedCache, { status: 200, headers: noCacheHeaders });
        } catch (err) {}
    }

    const todayStrUTC = getUTCDateString(new Date());
    const isAllTime = limitDays === "all";

    const dailyStatQuery: any = { dateString: { $lt: todayStrUTC } };
    if (!isAllTime) {
        const limitNum = Number(limitDays) || 60;
        const pastDaysLimit = new Date(); 
        pastDaysLimit.setUTCDate(pastDaysLimit.getUTCDate() - limitNum);
        dailyStatQuery.dateString = { $gte: getUTCDateString(pastDaysLimit), $lt: todayStrUTC };
    }

    const dailyStatsAgg = await DailyStat.aggregate([
        { $match: dailyStatQuery },
        { $group: { 
            _id: "$dateString", 
            total: { $sum: { $ifNull: ["$totalNumbers", 0] } }, 
            allocation: { $sum: { $ifNull: ["$totalNumbers", 0] } },
            success: { $sum: { $ifNull: ["$successOTP", 0] } }, 
            failed: { $sum: { $cond: [{ $gt: ["$failedNumbers", null] }, "$failedNumbers", { $ifNull: ["$failed", 0] }] } }, 
            amount: { $sum: { $add: [{ $ifNull: ["$totalCost", 0] }, { $ifNull: ["$totalCommission", 0] }] } } 
        } }
    ]);

    const groupedRawData: Record<string, any> = {};
    const todayAppCounts: Record<string, number> = {};
    const todayHourlyTraffic = [0, 0, 0, 0, 0, 0];

    dailyStatsAgg.forEach((ds: any) => {
        const sCount = ds.success || 0;
        const fCount = ds.failed || 0;
        let finalTotal = ds.total || ds.allocation || 0;
        if (finalTotal === 0 && (sCount > 0 || fCount > 0)) finalTotal = sCount + fCount;

        groupedRawData[ds._id] = { total: finalTotal, allocation: finalTotal, success: sCount, failed: fCount, amount: ds.amount || 0 };
    });

    groupedRawData[todayStrUTC] = { total: 0, allocation: 0, success: 0, failed: 0, amount: 0 };

    const ordersCursor = Order.find({ dateString: todayStrUTC })
        .select("status createdAt updatedAt fullMessage orderCost orderCommission processedKeys")
        .lean()
        .cursor();

    let counter = 0;
    for await (const o of ordersCursor) {
        counter++;
        if (counter % 500 === 0) await releaseThread(); 

        const currentStatus = (o.status || "").toUpperCase(); 
        
        groupedRawData[todayStrUTC].total += 1;
        groupedRawData[todayStrUTC].allocation += 1; 

        if (currentStatus === "DONE" || currentStatus === "SUCCESS") {
            let exactValidCount = 0;
            if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) exactValidCount = o.processedKeys.length;
            else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
                const msgArray = o.fullMessage.split(/_\|\|_/);
                msgArray.forEach((m: string) => { 
                    if (m.trim() !== "" && !m.toLowerCase().includes("waiting")) exactValidCount += 1; 
                });
            }
            if (exactValidCount === 0) exactValidCount = 1;

            groupedRawData[todayStrUTC].success += exactValidCount;
            groupedRawData[todayStrUTC].amount += ((o.orderCost || 0) + (o.orderCommission || 0));

            const hour = new Date(o.updatedAt || o.createdAt || new Date()).getUTCHours();
            const bIdx = Math.floor(hour / 4);
            if(bIdx >= 0 && bIdx <= 5) todayHourlyTraffic[bIdx] += exactValidCount;

            let sName = extractServiceName(o.fullMessage);
            todayAppCounts[sName] = (todayAppCounts[sName] || 0) + exactValidCount;
            
        } else if (!["PENDING", "WAITING", "WAIT", "PROCESSING"].includes(currentStatus)) {
            groupedRawData[todayStrUTC].failed += 1;
        }
    }

    const yesterdayDate = new Date(); 
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const defaultData = { success: 0, amount: 0, total: 0, allocation: 0, failed: 0 };
    const todayData = groupedRawData[todayStrUTC] || defaultData;
    const yesterdayData = groupedRawData[yesterdayStrUTC] || defaultData;

    const responsePayload = {
        success: true, groupedRawData, todayAppCounts, todayHourlyTraffic,
        serverDate: todayStrUTC, todaySuccess: todayData.success, todaySpend: todayData.amount, 
        yesterdaySuccess: yesterdayData.success, yesterdaySpend: yesterdayData.amount
    };

    // Store in Redis for exactly 15 seconds to match UI
    await redis.set(cacheKey, JSON.stringify(responsePayload), "EX", 15).catch(() => null);
    
    return NextResponse.json(responsePayload, { headers: noCacheHeaders });

  } catch (error) { return NextResponse.json({ success: false }, { status: 500 }); }
}