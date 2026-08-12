import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import Order from "../../../models/Order"; 
import mongoose from "mongoose";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// 💥 SERVER-SIDE IN-MEMORY CACHE (Database Protector) 💥
let cachedData: any = null;
let lastFetchTime = 0;

// 💥 OPTIMIZATION: 3 Seconds Cache for LIVE Feel + Promise Lock for DB Protection 💥
const CACHE_TTL = 3000; 

// 🚀 BOSS UPGRADE: PROMISE LOCK (Prevents Thundering Herd / Cache Stampede) 🚀
let fetchPromise: Promise<void> | null = null;

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
            masked = masked.replace(regex, (match: string) => {
                return match.replace(/[^\s]/g, '*');
            });
        }
    });
    return masked;
};

// 💥 THE BOSS FIX: DYNAMIC SERVICE EXTRACTOR (UPPERCASE FOR UI) 💥
const extractServiceName = (msg: string, dynamicServices: string[] = []) => {
    if (!msg) return "OTHER";

    // 1. Read Exact Tag Injected by Engine-2 AI Scanner (for legacy data)
    const serviceMatch = msg.match(/\[Service:\s*([^\]]+)\]/i);
    if (serviceMatch && serviceMatch[1]) {
        return serviceMatch[1].trim().toUpperCase(); 
    }

    // 2. Comprehensive AI Fallback for NEW CLEAN DATA
    const text = msg.toLowerCase();
    
    // 💥 CMS Dynamic Services Check 💥
    if (dynamicServices && dynamicServices.length > 0) {
        for (const service of dynamicServices) {
            if (text.includes(service.toLowerCase())) {
                return service.toUpperCase();
            }
        }
    }
    
    // 💥 UPGRADE 1: GLOBAL SERVICE DETECTION ENGINE -> UPPERCASE 💥
    if (text.includes('facebook') || text.includes(' fb ') || text.includes('facebk') || text.includes('fb.me') || text.includes('h29q+fsn4sr') || text.includes('laz+nxcarlw') || text.includes('فيسبوك') || text.includes('फेसबुक') || text.includes('ফেসবুক') || text.includes('脸书') || text.includes('ፌስቡክ') || text.includes('ფეისბუქი')) return 'FACEBOOK';
    if (text.includes('whatsapp') || text.includes(' wa ') || text.includes('vwaq') || text.includes('wa.me') || text.includes('واتساب') || text.includes('वाट्सएप') || text.includes('হোয়াটসঅ্যাপ') || text.includes('వాట్సాప్') || text.includes('왓츠앱')) return 'WHATSAPP';
    if (text.includes('telegram') || text.includes('t.me') || text.includes('تيليجرام') || text.includes('टेलीग्राम') || text.includes('টেলিগ্রাম') || text.includes('телеграм') || text.includes('电报') || text.includes('ቴሌግራም')) return 'TELEGRAM';
    if (text.includes('instagram') || text.includes(' ig ') || text.includes('ig.me') || text.includes('انستجرام') || text.includes('इंस्टाग्राम') || text.includes('ইন্সটাগ্রাম') || text.includes('인스타그램')) return 'INSTAGRAM';
    if (text.includes('google') || /g-\d+/.test(text) || text.includes('gmail') || text.includes('youtube') || text.includes('g.co') || text.includes('جوجل') || text.includes('गूगल') || text.includes('গুগল') || text.includes('谷歌') || text.includes('구글') || text.includes('гугл')) return 'GOOGLE';
    
    if (text.includes('w5eue21qadh') || text.includes('imo') || text.includes('ايمو') || text.includes('ইমো')) return 'IMO';
    if (text.includes('ftptmjpdh') || text.includes('viber') || text.includes('فايبر') || text.includes('ভাইবার')) return 'VIBER';
    
    if (text.includes('meta')) return 'META';
    if (text.includes('lalamove')) return 'LALAMOVE'; 
    if (text.includes('tiktok') || text.includes(' tt ') || text.includes('تيك توك') || text.includes('टिकटॉक') || text.includes('টিকটক') || text.includes('틱톡')) return 'TIKTOK';
    if (text.includes('snapchat')) return 'SNAPCHAT';
    if (text.includes('twitter') || text.includes(' x ') || text.includes('for x')) return 'X';
    if (text.includes('apple') || text.includes('icloud')) return 'APPLE';
    if (text.includes('microsoft') || text.includes('live') || text.includes('outlook')) return 'MICROSOFT';
    if (text.includes('amazon') || text.includes('prime')) return 'AMAZON';
    if (text.includes('netflix')) return 'NETFLIX';
    if (text.includes('uber') && !text.includes('airbnb')) return 'UBER';
    if (text.includes('paypal') || text.includes('pay pal')) return 'PAYPAL';
    if (text.includes('cashapp') || text.includes('cash app')) return 'CASHAPP';
    if (text.includes('venmo')) return 'VENMO';
    if (text.includes('tinder')) return 'TINDER';
    if (text.includes('bumble')) return 'BUMBLE';
    if (text.includes('discord')) return 'DISCORD';
    if (text.includes('twitch')) return 'TWITCH';
    if (text.includes('yahoo')) return 'YAHOO';
    if (text.includes('wechat')) return 'WECHAT';
    if (text.includes('line')) return 'LINE';
    if (text.includes('kakaotalk')) return 'KAKAOTALK';
    if (text.includes('airbnb')) return 'UBER/AIRBNB'; 
    if (text.includes('binance') || text.includes('بینانس') || text.includes('बाइनेंस') || text.includes('বাইনান্স')) return 'BINANCE';
    if (text.includes('coinbase')) return 'COINBASE';
    if (text.includes('kucoin') && !text.includes('kraken')) return 'KUCOIN';
    if (text.includes('kraken')) return 'KUCOIN/KRAKEN';
    if (text.includes('epic games')) return 'EPIC GAMES';
    if (text.includes('steam')) return 'STEAM';
    if (text.includes('riot')) return 'RIOT GAMES';
    if (text.includes('daraz')) return 'DARAZ';
    if (text.includes('pathao')) return 'PATHAO';
    if (text.includes('foodpanda')) return 'FOODPANDA';

    return "OTHER"; 
};

export async function GET(req: NextRequest) {
  try {
    // 💥 1. CACHE INTERCEPTOR: Serve instantly from RAM to save DB 💥
    if (cachedData && (Date.now() - lastFetchTime < CACHE_TTL)) {
      return NextResponse.json(cachedData);
    }

    // 🚀 2. PROMISE LOCK INTERCEPTOR: If a DB fetch is already in progress, wait for it! 🚀
    if (fetchPromise) {
      await fetchPromise;
      return NextResponse.json(cachedData);
    }

    // 🚀 3. INITIALIZE DB FETCH WITH PROMISE LOCK 🚀
    fetchPromise = (async () => {
      await connectToDatabase();

      // 💥 AUTO INDEXING ENGINE (Prevents Lag) 💥
      try {
          if (Order.collection) {
              Order.collection.createIndex({ status: 1, updatedAt: -1 }, { background: true }).catch(() => {});
          }
      } catch (idxErr) {}

      // 💥 FETCH SECRET MASKING KEYWORDS & DYNAMIC SERVICES FROM DB 💥
      const settingsCollection = mongoose.connection.collection("system_settings");
      const sysSettings = await settingsCollection.findOne({ type: "global" });
      const hiddenKeywords = sysSettings?.hiddenKeywords || [];
      const dynamicServices = sysSettings?.dynamicServices || []; 

      // 💥 OPTIMIZATION: Fetching Last 30 Minutes 💥
      const thirtyMinsAgoDate = new Date(Date.now() - 30 * 60 * 1000); 

      // 💥 QUERY ONE (For Charts): Fetch optimized logs 💥
      const statsOrders = await Order.find({ 
        status: { $in: ["DONE", "Success"] },
        updatedAt: { $gte: thirtyMinsAgoDate } 
      })
      .select("fullMessage otp operator") 
      .lean();

      const appCounts: Record<string, number> = {};
      const carrierCounts: Record<string, number> = {};

      statsOrders.forEach((log: any) => {
        let rawMsg = log.fullMessage || log.otp || "";
        if (rawMsg.includes("_||_")) {
            const msgParts = rawMsg.split("_||_");
            rawMsg = msgParts[msgParts.length - 1].trim();
        }

        const rawService = extractServiceName(rawMsg, dynamicServices);
        const service = applyMasking(rawService, hiddenKeywords);
        
        const op = log.operator || "Other";
        appCounts[service] = (appCounts[service] || 0) + 1;
        carrierCounts[op] = (carrierCounts[op] || 0) + 1;
      });

      let graphData = Object.keys(appCounts)
        .map(key => ({ name: key, value: appCounts[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8); 

      let pad = " ";
      while (graphData.length < 8) {
        graphData.push({ name: pad, value: 0 });
        pad += " ";
      }

      const carrierData = Object.keys(carrierCounts)
        .map(key => ({ name: key, value: carrierCounts[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      // 💥 QUERY TWO (For UI Feed): Fetch ONLY the latest 50 logs 💥
      const feedOrders = await Order.find({ status: { $in: ["DONE", "Success"] } })
        .sort({ updatedAt: -1 }) 
        .select("searchNumber number fullMessage otp country operator createdAt updatedAt") 
        .limit(50) 
        .lean();

      // 🛡️ 100% BULLETPROOF SERVER-SIDE DATA MASKING 🛡️
      const localLogs = feedOrders.map((log: any) => {
        const rawNum = log.searchNumber || log.number || "";
        const maskedNum = rawNum.length > 4 ? rawNum.slice(0, -3) + "XXX" : rawNum;
        
        let originalMsg = log.fullMessage || log.otp || "";
        if (originalMsg.includes("_||_")) {
            const msgParts = originalMsg.split("_||_");
            originalMsg = msgParts[msgParts.length - 1].trim(); 
        }
        
        let rawService = extractServiceName(originalMsg, dynamicServices);
        let maskedServiceTag = applyMasking(rawService, hiddenKeywords);
        let cleanMsg = originalMsg;

        let maskedMsg = cleanMsg.replace(/\b\d{3,12}\b/g, (match: string) => {
            return '*'.repeat(match.length);
        }); 
        
        maskedMsg = applyMasking(maskedMsg, hiddenKeywords);

        return {
          id: log._id.toString(),
          number: maskedNum, 
          otp: maskedMsg,    
          country: log.country || "BD",
          operator: log.operator || "Other",
          service: maskedServiceTag, 
          createdAt: new Date(log.updatedAt || log.createdAt).getTime()
        };
      });

      // 💥 4. SAVE TO RAM CACHE 💥
      cachedData = { 
        success: true, 
        logs: localLogs, 
        graph: graphData, 
        carrier: carrierData
      };
      lastFetchTime = Date.now();
    })();

    // 🚀 Wait for the lock to resolve, then release it 🚀
    try {
      await fetchPromise;
    } finally {
      fetchPromise = null; 
    }

    return NextResponse.json(cachedData);

  } catch (error: any) {
    fetchPromise = null; // 💥 ALWAYS RELEASE LOCK ON ERROR 💥
    console.error("Live Console Critical Error:", error.message);
    if (cachedData) return NextResponse.json(cachedData);
    return NextResponse.json({ success: false, error: "Server Error" }, { status: 500 });
  }
}