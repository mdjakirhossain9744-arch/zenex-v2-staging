import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order"; 
import User from "../../../models/User";

export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

// 💥 THE BOSS FIX: Added Global SDE Mapper in Next.js to fix "Country Unknown" 💥
const globalSdeMap = new Map();
let isSdeFetched = false;

async function fetchSdeList(apiKey: string) {
    if (isSdeFetched) return;
    try {
        const payload = { jsonrpc: "2.0", method: "sms.realtime:get_subdestination_list", params: {}, id: Date.now() };
        const res = await fetch("https://api.iprn-elite.com/v1.0", {
            method: "POST",
            headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data?.result?.subdestination_list) {
            data.result.subdestination_list.forEach((item: any) => {
                globalSdeMap.set(item.sde_key, item.name);
            });
            isSdeFetched = true;
        }
    } catch (e) {}
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { range, email } = body; 

    // STRICT SESSION VERIFICATION
    if (!email) {
        const token = request.cookies.get("zenex_token")?.value;
        if (token) {
            try {
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = JSON.parse(atob(payloadBase64));
                email = decodedPayload.email;
            } catch (e) {
                console.error("JWT Decode error");
            }
        }
    }

    if (!email) {
       return NextResponse.json({ error: "Unauthorized: User Session Expired or Email Missing" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: new RegExp(`^${email.trim()}$`, 'i') }).lean();
    if (!user || user.status !== "active") {
        return NextResponse.json({ error: "Account Inactive or Blocked" }, { status: 403 });
    }

    const rid = (range || "").replace(/x/gi, '').trim(); 
    if (!rid) return NextResponse.json({ error: "Invalid Range Format" }, { status: 400 });

    const IPRN_API_URL = "https://api.iprn-elite.com/v1.0";
    const IPRN_API_KEY = process.env.IPRN_API_KEY || "1ddOYcGxRcWUlyi6T7oZzA"; 

    // Fetch SDE List to resolve exact country name
    await fetchSdeList(IPRN_API_KEY);

    const payload = {
        jsonrpc: "2.0",
        method: "sms.realtime:allocate",
        params: { 
            senderid: "OTP", 
            prefix_list: [String(rid).toUpperCase()], 
            dont_check_access: true
        },
        id: Date.now()
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); 

    let response;
    try {
        response = await fetch(IPRN_API_URL, {
            method: "POST",
            headers: { "Api-Key": IPRN_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (fetchErr) {
        clearTimeout(timeoutId);
        return NextResponse.json({ error: "Provider is slow or timed out. Try again." }, { status: 504 });
    }

    const data = await response.json();

    if (data.error) {
        return NextResponse.json({ error: data.error.message || "Out of stock or Invalid Range" }, { status: 400 });
    }

    // INSTANT NUMBER EXTRACTION & DIRECT DB SAVE
    if (data.result && data.result.number && data.result.number.full) {
        const trxId = data.result.message_id || "";
        const fullNumStr = String(data.result.number.full);
        const localNumStr = String(data.result.number.local_number || fullNumStr);

        // 💥 Resolve Exact Country & Operator 💥
        let exactCountry = "Unknown";
        let exactOperator = "Mobile";
        if (data.result.sde_key && globalSdeMap.has(data.result.sde_key)) {
            let rawName = globalSdeMap.get(data.result.sde_key);
            rawName = rawName.replace(/\s*\([\d+X]+\)\s*$/g, '').trim();
            const parts = rawName.split(' - ');
            exactCountry = parts[0] ? parts[0].trim() : "Unknown";
            if (parts.length >= 3) {
                exactOperator = parts[2].trim();
            } else if (parts.length === 2) {
                exactOperator = parts[1].trim().toLowerCase() === "mobile" ? "Mobile" : parts[1].trim();
            }
        }

        const matchedName = user.fullName || user.email.split("@")[0] || "User";
        const matchedUid = user.uid || user.zxId || (user._id ? `ZX-${user._id.toString().slice(-6).toUpperCase()}` : "ZX-UNKNOWN");
        const matchedAgent = (user.agentEmail || user.customAgentMail || "admin").toLowerCase();

        let savedOrderId = null;
        try {
            const newOrder = new Order({
                userEmail: user.email,
                userName: matchedName,
                userUid: matchedUid,
                agentEmail: matchedAgent,
                searchNumber: fullNumStr,
                requestedRange: rid,
                trxId: String(trxId),
                displayNumber: `+${fullNumStr}`,
                country: exactCountry,
                operator: exactOperator,
                status: "WAIT",
                fullMessage: "Waiting...",
                otp: "Waiting...",
                trueService: "Unknown",
                dateString: getUTCDateString(),
                expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
            });
            const savedRecord = await newOrder.save();
            savedOrderId = savedRecord._id.toString();
        } catch (dbError) {
            console.error("⚠️ Next.js DB Save Error:", dbError);
            return NextResponse.json({ error: "Failed to save order to Database" }, { status: 500 });
        }

        // 💥 CRITICAL PAYLOAD CLEANUP (Exactly as instructed) 💥
        return NextResponse.json({
            success: true,
            data: {
                full_number: `+${fullNumStr}`,
                national_number: localNumStr,
                no_plus_number: fullNumStr,
                country: exactCountry,
                operator: exactOperator,
                status: "pending"
            },
            orderId: savedOrderId,
            message: "number allocated"
        });
    }

    return NextResponse.json({ error: "Failed to allocate number from Provider." }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}