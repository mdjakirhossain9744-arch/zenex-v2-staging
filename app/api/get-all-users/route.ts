export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb"; 
import User from "../../../models/User"; 
import Order from "../../../models/Order";
import Redis from "ioredis";

const redis = new Redis(); 
const yieldToEventLoop = () => new Promise((resolve) => setTimeout(resolve, 0));

const getUTCDateString = (dateObj: any = new Date()) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC', 
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date(dateObj));
  } catch (e) { 
    return new Date().toISOString().split('T')[0]; 
  }
};

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;
    if (!token) return NextResponse.json({ message: "🔴 UNAUTHORIZED" }, { status: 401 });

    try {
      const payloadBase64 = token.split('.')[1];
      const decodedString = Buffer.from(payloadBase64, 'base64').toString('utf-8');
      const decodedPayload = JSON.parse(decodedString);
      
      if (decodedPayload.role !== "admin") return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 });
    } catch (err) { return NextResponse.json({ message: "🔴 FORBIDDEN" }, { status: 403 }); }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const rawSearchQuery = searchParams.get("search")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim().toLowerCase() || "all";
    const agentFilter = searchParams.get("agent")?.trim() || "all";

    const PAGE_CACHE_KEY = `get_all_users_${page}_${limit}_${rawSearchQuery}_${statusFilter}_${agentFilter}`;
    const cachedPage = await redis.get(PAGE_CACHE_KEY).catch(() => null);
    if (cachedPage) {
        return NextResponse.json(JSON.parse(cachedPage), { status: 200 });
    }

    await connectToDatabase();

    if (User.collection && Order.collection) {
      Promise.all([
        User.collection.createIndex({ email: 1 }).catch(() => {}),
        Order.collection.createIndex({ dateString: 1, status: 1 }).catch(() => {})
      ]).catch(() => {});
    }

    let query: any = {};
    
    if (rawSearchQuery) {
        const safeSearch = rawSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const searchRegex = new RegExp(safeSearch, "i");

        const orConditions: any[] = [
            { fullName: searchRegex },
            { email: searchRegex },
            { customAgentMail: searchRegex },
            { agentEmail: searchRegex }
        ];

        if (/^zx-[a-f0-9]{1,6}$/i.test(rawSearchQuery)) {
            const hexPart = rawSearchQuery.replace(/^zx-/i, '').toLowerCase();
            orConditions.push({
                $expr: {
                    $regexMatch: {
                        input: { $toString: "$_id" },
                        regex: `${hexPart}$`,
                        options: "i"
                    }
                }
            });
        } else if (/^[a-f0-9]{24}$/i.test(rawSearchQuery)) {
            orConditions.push({ _id: rawSearchQuery });
        }

        query.$or = orConditions;
    }

    if (statusFilter && statusFilter !== "all") query.status = statusFilter;
    if (agentFilter && agentFilter !== "all") query.agentEmail = agentFilter;

    const skip = (page - 1) * limit;
    
    const [totalUsersInQuery, users] = await Promise.all([
        User.countDocuments(query),
        User.find(query)
          .select("-password")
          .sort({ role: 1, createdAt: -1 }) 
          .skip(skip)
          .limit(limit)
          .lean()
    ]);

    const userEmails = users.map((u: any) => (u.email || "").toLowerCase().trim());
    const todayStr = getUTCDateString(); 

    // 💥 Added processedKeys to selection for accurate OTP counting
    const ordersCursor = Order.find({
        dateString: todayStr, 
        status: { $in: ["DONE", "Success", "SUCCESS"] },
        $or: [
            { userEmail: { $in: userEmails } },
            { email: { $in: userEmails } }
        ]
    }).select("userEmail email createdAt updatedAt dateString fullMessage processedKeys").cursor();

    const otpCounts: Record<string, number> = {};
    let oCount = 0;
    
    for await (const o of ordersCursor) {
        const e = (o.userEmail || o.email || "").toLowerCase().trim();
        
        // 💥 THE BOSS BONUS FIX: EXACT MULTI-OTP COUNTING FOR ADMIN PANEL 💥
        let msgCount = 0;
        if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) {
            msgCount = o.processedKeys.length;
        } else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
            const msgArray = o.fullMessage.split(" _||_ ");
            msgArray.forEach((m: string) => {
                const cleanMsg = m.trim().toLowerCase();
                if (cleanMsg !== "" && !cleanMsg.includes("waiting")) {
                    msgCount += 1;
                }
            });
        }
        if (msgCount === 0) msgCount = 1;

        otpCounts[e] = (otpCounts[e] || 0) + msgCount;
        
        if (++oCount % 500 === 0) await yieldToEventLoop();
    }

    const formattedUsers = users.map((u: any) => {
      const uEmail = (u.email || "").toLowerCase().trim();
      const todayOtpCount = otpCounts[uEmail] || 0;

      return {
        id: u._id,
        uid: u._id ? `ZX-${u._id.toString().substring(18, 24).toUpperCase()}` : "ZX-UNKNOWN",
        name: u.fullName,
        email: u.email,
        role: u.role,
        agentEmail: u.agentEmail || "Admin",
        balance: Number(u.balance || 0).toFixed(2),
        status: u.status === 'active' ? 'Active' : u.status === 'pending' ? 'Pending' : 'Banned',
        todayOTP: todayOtpCount, 
        rate: (u.otpRate !== undefined && u.otpRate !== null) ? Number(u.otpRate).toFixed(2) : "0.00",
        customAgentMail: u.customAgentMail || "", 
        telegramLink: u.telegramLink || "",
        agentMaxUsers: u.agentMaxUsers || 100,
        isApiActive: u.isApiActive || false,
        canManageApi: u.canManageApi || false 
      };
    });

    const STATS_CACHE_KEY = "global_system_stats_cache";
    let systemStats: any = null;
    const cachedStats = await redis.get(STATS_CACHE_KEY).catch(() => null);

    if (cachedStats) {
        systemStats = JSON.parse(cachedStats);
    } else {
        const [globalTotalUsers, totalAgents, activeAccounts, bannedAccounts, liabilityAgg] = await Promise.all([
            User.countDocuments({ role: "user" }),
            User.countDocuments({ role: "agent" }),
            User.countDocuments({ status: "active" }),
            User.countDocuments({ status: "banned" }),
            User.aggregate([
                { $match: { role: { $in: ["user", "agent"] } } },
                { $group: { _id: null, total: { $sum: { $convert: { input: "$balance", to: "double", onError: 0, onNull: 0 } } } } }
            ])
        ]);
        
        systemStats = {
          totalUsers: globalTotalUsers, 
          totalAgents, 
          activeAccounts, 
          bannedAccounts, 
          systemLiability: (liabilityAgg[0]?.total || 0).toFixed(2) 
        };
        await redis.set(STATS_CACHE_KEY, JSON.stringify(systemStats), "EX", 60).catch(() => null);
    }

    const responsePayload = { 
        users: formattedUsers,
        pagination: { total: totalUsersInQuery, page, limit, totalPages: Math.ceil(totalUsersInQuery / limit) || 1 },
        stats: systemStats
    };

    await redis.set(PAGE_CACHE_KEY, JSON.stringify(responsePayload), "EX", 15).catch(() => null);

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (error: any) { 
    return NextResponse.json({ message: `Error: ${error.message}` }, { status: 500 }); 
  }
}