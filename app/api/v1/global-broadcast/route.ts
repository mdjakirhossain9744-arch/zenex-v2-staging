import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import Order from "../../../../models/Order";
import User from "../../../../models/User"; 
import mongoose from "mongoose";
import redis from "../../../lib/redis"; 

export const dynamic = "force-dynamic";

const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

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

// 💥 UPGRADE 1: GLOBAL SERVICE DETECTION ENGINE (UPPERCASE) 💥
// 🔥 Added dynamicServices array parameter from CMS 🔥
const extractServiceName = (msg: string, existingService: string, dynamicServices: string[] = []) => {
    if (existingService && existingService.toLowerCase() !== 'other' && existingService.toLowerCase() !== 'unknown' && existingService.trim() !== '') {
        return existingService.toUpperCase();
    }
    if (!msg) return "OTHER";
    const text = msg.toLowerCase();
    
    // 💥 CMS Dynamic Services Check 💥
    if (dynamicServices && dynamicServices.length > 0) {
        for (const service of dynamicServices) {
            if (text.includes(service.toLowerCase())) {
                return service.toUpperCase();
            }
        }
    }
    
    if (text.includes('facebook') || text.includes(' fb ') || text.includes('facebk') || text.includes('fb.me') || text.includes('h29q+fsn4sr') || text.includes('laz+nxcarlw') || text.includes('فيسبوك') || text.includes('फेसबुक') || text.includes('ফেসবুক') || text.includes('脸书') || text.includes('ፌስቡክ') || text.includes('ფეისბუქი') || text.includes('фэйсбук')) return 'FACEBOOK';
    if (text.includes('whatsapp') || text.includes(' wa ') || text.includes('vwaq') || text.includes('wa.me') || text.includes('واتساب') || text.includes('वाट्सएप') || text.includes('হোয়াটসঅ্যাপ') || text.includes('వాట్సాప్') || text.includes('왓츠앱') || text.includes('ватсап')) return 'WHATSAPP';
    if (text.includes('telegram') || text.includes(' tg ') || text.includes('t.me') || text.includes('تيليجرام') || text.includes('टेलीग्राम') || text.includes('টেলিগ্রাম') || text.includes('телеграм') || text.includes('电报') || text.includes('ቴሌግራም')) return 'TELEGRAM';
    if (text.includes('instagram') || text.includes(' ig ') || text.includes('ig.me') || text.includes('انستجرام') || text.includes('इंस्टाग्राम') || text.includes('ইন্সটাগ্রাম') || text.includes('인스타그램') || text.includes('инстаграм')) return 'INSTAGRAM';
    if (text.includes('google') || /g-\d+/.test(text) || text.includes('gmail') || text.includes('youtube') || text.includes('g.co') || text.includes('جوجل') || text.includes('गूगल') || text.includes('গুগল') || text.includes('谷歌') || text.includes('구글') || text.includes('гугл')) return 'GOOGLE';
    if (text.includes('w5eue21qadh') || text.includes('imo') || text.includes('ايمو') || text.includes('ইমো') || text.includes('имо')) return 'IMO';
    if (text.includes('ftptmjpdh') || text.includes('viber') || text.includes('فايبر') || text.includes('ভাইবার') || text.includes('вайбер')) return 'VIBER';
    if (text.includes('meta')) return 'META';
    if (text.includes('lalamove')) return 'LALAMOVE'; 
    if (text.includes('tiktok') || text.includes(' tt ') || text.includes('تيك توك') || text.includes('टिकटॉक') || text.includes('টিকটক') || text.includes('틱톡') || text.includes('тикток')) return 'TIKTOK';
    if (text.includes('snapchat')) return 'SNAPCHAT';
    if (text.includes('twitter') || text.includes(' x ') || text.includes('for x')) return 'X';
    if (text.includes('apple') || text.includes(' ap ') || text.includes('icloud')) return 'APPLE';
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
    if (text.includes('binance') || text.includes('بینانس') || text.includes('बाइनेंस') || text.includes('বাইনান্স') || text.includes('бинанс')) return 'BINANCE';
    if (text.includes('coinbase')) return 'COINBASE';
    if (text.includes('kucoin') && !text.includes('kraken')) return 'KUCOIN';
    if (text.includes('kraken')) return 'KUCOIN/KRAKEN';
    if (text.includes('epic games')) return 'EPIC GAMES';
    if (text.includes('steam')) return 'STEAM';
    if (text.includes('riot')) return 'RIOT GAMES';
    if (text.includes('daraz')) return 'DARAZ';
    if (text.includes('pathao')) return 'PATHAO';
    if (text.includes('foodpanda')) return 'FOODPANDA';
    if (text.includes('1xbet')) return '1XBET';
    
    return "OTHER";
};

export async function GET(req: Request) {
  try {
    const mapikey = req.headers.get("mapikey") as string | null;

    if (!mapikey || mapikey.trim().length < 10) {
      return NextResponse.json({ success: false, message: "Unauthorized! Valid API Key Required." }, { status: 401 });
    }

    const cleanKey = mapikey.trim();
    let isAuthorized = false;

    // 💥 LAYER 1: REDIS AUTH CACHE (Zero-DB Key Validation) 💥
    const AUTH_CACHE_KEY = `auth_api_${cleanKey}`;
    if (redis) {
        const cachedAuth = await redis.get(AUTH_CACHE_KEY);
        if (cachedAuth === "valid") {
            isAuthorized = true;
        } else if (cachedAuth === "invalid") {
            return NextResponse.json({ success: false, message: "Unauthorized! API Access is disabled or invalid key." }, { status: 403 });
        }
    }

    await connectToDatabase();

    // 💥 LAYER 2: FALLBACK DB AUTH (Runs only once a minute per user) 💥
    if (!isAuthorized) {
        const user = await User.findOne({ apiKey: cleanKey }).select("isApiActive status").lean();
        if (!user || !user.isApiActive || user.status !== "active") {
            if (redis) await redis.set(AUTH_CACHE_KEY, "invalid", "EX", 60);
            return NextResponse.json({ success: false, message: "Unauthorized! API Access is disabled or invalid key." }, { status: 403 });
        }
        if (redis) await redis.set(AUTH_CACHE_KEY, "valid", "EX", 60);
    }

    // 💥 LAYER 3: REDIS DATA CACHE FOR GLOBAL FEED 💥
    const CACHE_KEY = "zenex_global_broadcast_secure_v2";
    if (redis) {
        const cachedData = await redis.get(CACHE_KEY);
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            return NextResponse.json({
                success: true,
                count: parsedData.length,
                message: "Global Live Feed Fetched Successfully! (Served from ⚡ Redis)",
                data: parsedData
            });
        }
    }

    const settingsCollection = mongoose.connection.collection("system_settings");
    const sysSettings = await settingsCollection.findOne({ type: "global" });
    const hiddenKeywords = sysSettings?.hiddenKeywords || [];
    const dynamicServices = sysSettings?.dynamicServices || []; // 🔥 Fetched CMS Services 🔥

    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const recentOrders = await Order.find({
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        updatedAt: { $gte: twoMinsAgo }
    }).select("_id fullMessage otp searchNumber number service updatedAt country operator").lean();

    const selectedOtps: any[] = [];

    recentOrders.forEach((order: any) => {
        // 💥 THE 50% MAGIC RULE 💥
        if (Math.random() > 0.5) {
            let rawNum = String(order.searchNumber || order.number || "").replace(/\D/g, "");
            
            // 🛡️ RANGE MASKING: First 6 digits + XXX (e.g., 447384XXX) 🛡️
            const maskedNum = rawNum.length >= 6 ? rawNum.substring(0, 6) + "XXX" : rawNum;

            const rawMsg = order.fullMessage || order.otp || "";
            // 💥 Passed dynamicServices to Extractor 💥
            const finalServiceName = applyMasking(extractServiceName(rawMsg, order.service, dynamicServices), hiddenKeywords);
            const safeMsg = applyMasking(rawMsg, hiddenKeywords); 
            
            selectedOtps.push({
                id: order._id.toString(),
                number: maskedNum,
                otp: safeMsg,
                service: finalServiceName,
                country: order.country || "Unknown",
                operator: order.operator || "Any",
                time: new Date(order.updatedAt).getTime() 
            });
        }
    });

    if (redis) {
        await redis.set(CACHE_KEY, JSON.stringify(selectedOtps), "EX", 10);
    }

    return NextResponse.json({
        success: true,
        count: selectedOtps.length,
        message: "Global Live Feed Fetched Successfully!",
        data: selectedOtps
    });

  } catch (error) {
    console.error("Global Broadcast API Error:", error);
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}