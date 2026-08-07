import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectToDatabase from "../../lib/mongodb";
import User from "../../../models/User";
import redis from "../../lib/redis"; // 💥 Redis Imported 💥

const JWT_SECRET = process.env.JWT_SECRET || "ZENEX_SUPER_SECRET_KEY_2024";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("zenex_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "No token found" }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; sessionId: string };
    } catch (jwtError) {
      return NextResponse.json({ message: "Invalid or Expired Token" }, { status: 401 });
    }

    // 💥 LAYER 1: REDIS SESSION CACHE (Zero-DB Verification) 💥
    const CACHE_KEY = `zenex_session_${decoded.id}`;
    if (redis) {
      const cachedSession = await redis.get(CACHE_KEY);
      if (cachedSession) {
        const u = JSON.parse(cachedSession);
        if (u.status === "banned" || u.status === "pending") {
          return NextResponse.json({ message: "Account restricted" }, { status: 401 });
        }
        if (!u.activeSessions || !u.activeSessions.includes(decoded.sessionId)) {
          return NextResponse.json({ message: "Logged in from another device. Session expired." }, { status: 401 });
        }
        return NextResponse.json({ message: "Session is valid (Cached)" }, { status: 200 });
      }
    }

    // 💥 LAYER 2: FALLBACK TO MONGODB (Runs only once every 30 seconds per user) 💥
    try {
      await connectToDatabase();
      
      const user = await User.findById(decoded.id).select("activeSessions status").lean();

      if (!user) {
        return NextResponse.json({ message: "User not found" }, { status: 401 });
      }

      // Save to Redis for 30 Seconds to prevent DB load on rapid refreshes
      if (redis) {
        await redis.set(CACHE_KEY, JSON.stringify({ status: user.status, activeSessions: user.activeSessions }), "EX", 30);
      }

      if (user.status === "banned" || user.status === "pending") {
         return NextResponse.json({ message: "Account restricted" }, { status: 401 });
      }

      if (!user.activeSessions || !user.activeSessions.includes(decoded.sessionId)) {
        return NextResponse.json({ message: "Logged in from another device. Session expired." }, { status: 401 });
      }

      return NextResponse.json({ message: "Session is valid" }, { status: 200 });

    } catch (dbError) {
      console.warn("DB Timeout in check-session. Skipping logout.");
      return NextResponse.json({ message: "Database busy, skipping check" }, { status: 500 });
    }

  } catch (error) {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}