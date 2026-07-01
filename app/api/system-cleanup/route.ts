import { NextResponse, NextRequest } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch (e) { return new Date().toISOString().split('T')[0]; }
};

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const secretKey = searchParams.get("key");

    if (secretKey !== "ZENEX_CLEANUP_2026") {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: Access Denied!" }, { status: 403 });
    }

    await connectToDatabase();

    const todayStrUTC = getUTCDateString(new Date());
    
    const yesterdayDate = new Date();
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayStrUTC = getUTCDateString(yesterdayDate);

    const twoDaysAgoDate = new Date();
    twoDaysAgoDate.setUTCDate(twoDaysAgoDate.getUTCDate() - 2);
    const twoDaysAgoMidnight = new Date(getUTCDateString(twoDaysAgoDate) + "T00:00:00.000Z");

    const tenDaysAgoDate = new Date();
    tenDaysAgoDate.setUTCDate(tenDaysAgoDate.getUTCDate() - 10);
    const tenDaysAgoMidnight = new Date(getUTCDateString(tenDaysAgoDate) + "T00:00:00.000Z");

    // 1. BACKUP YESTERDAY'S ORDERS INTO DAILY_STATS
    const yesterdayOrders = await Order.find({
        createdAt: { 
            $gte: new Date(yesterdayStrUTC + "T00:00:00.000Z"), 
            $lt: new Date(todayStrUTC + "T00:00:00.000Z") 
        }
    }).lean();

    const statsMap: Record<string, any> = {};

    yesterdayOrders.forEach((o: any) => {
        const oDate = getUTCDateString(o.createdAt || new Date(o.dateString));
        const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();
        const key = `${oDate}_${uEmail}`;

        if (!statsMap[key]) {
            statsMap[key] = { dateString: oDate, userEmail: uEmail, total: 0, success: 0, failed: 0, amount: 0, commission: 0 };
        }

        statsMap[key].total += 1; 

        if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
            
            // 🔥 MISSION 1 FIX: EXACT MULTI-OTP COUNT (Zero Missing!) 🔥
            let exactValidCount = 0;
            
            if (Array.isArray(o.processedKeys) && o.processedKeys.length > 0) {
                exactValidCount = o.processedKeys.length;
            } else if (typeof o.fullMessage === "string" && o.fullMessage.trim() !== "") {
                const msgArray = o.fullMessage.split(/_\|\|_/);
                msgArray.forEach((m: string) => {
                    const cleanMsg = m.trim().toLowerCase();
                    if (cleanMsg !== "" && !cleanMsg.includes("waiting")) {
                        exactValidCount += 1;
                    }
                });
            }
            if (exactValidCount === 0) exactValidCount = 1;

            statsMap[key].success += exactValidCount;
            statsMap[key].amount += (o.orderCost || 0);
            statsMap[key].commission += (o.orderCommission || 0);
            
        } else {
            statsMap[key].failed += 1;
        }
    });

    for (const key in statsMap) {
        const stat = statsMap[key];
        await DailyStat.findOneAndUpdate(
            { dateString: stat.dateString, userEmail: stat.userEmail },
            { 
                $set: { 
                    totalNumbers: stat.total, 
                    successOTP: stat.success, 
                    failedNumbers: stat.failed,
                    totalCost: stat.amount,          
                    totalCommission: stat.commission 
                } 
            },
            { upsert: true, new: true }
        );
    }

    // 2. DELETE OLD ORDERS (Failed: 2 Days, Success: 10 Days)
    const deletedFailed = await Order.deleteMany({
        createdAt: { $lt: twoDaysAgoMidnight },
        status: { $nin: ["DONE", "Success", "SUCCESS"] }
    });

    const deletedSuccess = await Order.deleteMany({
        createdAt: { $lt: tenDaysAgoMidnight },
        status: { $in: ["DONE", "Success", "SUCCESS"] }
    });

    // 💥 3. SMART OPTIMIZATION: DELETE OLD RAW DATA (2 DAYS ONLY) 💥
    let deletedRawLogsCount = 0;
    try {
      const db = mongoose.connection.db;
      if (db) {
         const rawResult = await db.collection("rawlogs").deleteMany({
            timestamp: { $lt: twoDaysAgoMidnight } 
         });
         deletedRawLogsCount = rawResult.deletedCount || 0;
      }
    } catch (e) {
      console.error("RAW_DATA_CLEANUP_ERROR:", e);
    }

    return NextResponse.json({
        success: true,
        message: "✅ Backup & Full Cleanup Successful!",
        backupSaved: Object.keys(statsMap).length,
        deletedFailedOrders: deletedFailed.deletedCount,
        deletedSuccessOrders: deletedSuccess.deletedCount,
        deletedRawData: deletedRawLogsCount
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}