import { NextResponse, NextRequest } from "next/server";
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
            const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
            const uniqueCodes = new Set();
            
            msgArray.forEach((msg: string) => {
                const match = msg.match(/\b\d{4,8}\b/);
                uniqueCodes.add(match ? match[0] : msg.trim());
            });

            const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

            // 💥 MATH FIX: এখন WhatsApp ও Telegram-কেও Success হিসেবে কাউন্ট করা হবে 💥
            statsMap[key].success += validMsgCount;
            
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

    const deletedFailed = await Order.deleteMany({
        createdAt: { $lt: twoDaysAgoMidnight },
        status: { $nin: ["DONE", "Success", "SUCCESS"] }
    });

    const deletedSuccess = await Order.deleteMany({
        createdAt: { $lt: tenDaysAgoMidnight },
        status: { $in: ["DONE", "Success", "SUCCESS"] }
    });

    return NextResponse.json({
        success: true,
        message: "✅ Backup & Cleanup Successful!",
        backupSaved: Object.keys(statsMap).length,
        deletedFailedOrders: deletedFailed.deletedCount,
        deletedSuccessOrders: deletedSuccess.deletedCount
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}