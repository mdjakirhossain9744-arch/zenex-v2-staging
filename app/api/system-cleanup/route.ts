import { NextResponse, NextRequest } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

const getBDDateString = (dateObj: any = new Date()) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateObj)); } 
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

    const todayStrBD = getBDDateString(new Date());
    
    // 💥 SMART FIX: স্কিমা চেঞ্জ না করে শুধু "গতকালের (Yesterday)" ডাটা বের করার লজিক 💥
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStrBD = getBDDateString(yesterdayDate);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // শুধু গতকালের ডাটাগুলো ডায়েরিতে সেভ হবে (ফলে ৭ দিন ধরে ডাবল-কাউন্ট হবে না)
    const yesterdayOrders = await Order.find({
        createdAt: { 
            $gte: new Date(yesterdayStrBD + "T00:00:00.000Z"), 
            $lt: new Date(todayStrBD + "T00:00:00.000Z") 
        }
    }).lean();

    const statsMap: Record<string, any> = {};

    yesterdayOrders.forEach((o: any) => {
        const oDate = getBDDateString(o.createdAt || new Date(o.dateString));
        const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();
        const key = `${oDate}_${uEmail}`;

        if (!statsMap[key]) {
            statsMap[key] = { dateString: oDate, userEmail: uEmail, total: 0, success: 0, failed: 0 };
        }

        statsMap[key].total += 1; // ১টা অর্ডার = ১টা টোটাল নাম্বার

        if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
            const msgLower = (o.fullMessage || "").toLowerCase();
            const isFreeService = msgLower.includes("whatsapp") || msgLower.includes("telegram") || msgLower.includes("t.me");

            const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
            const uniqueCodes = new Set();
            
            msgArray.forEach((msg: string) => {
                const match = msg.match(/\b\d{4,8}\b/);
                uniqueCodes.add(match ? match[0] : msg.trim());
            });

            const validMsgCount = uniqueCodes.size > 0 ? uniqueCodes.size : 1;

            if (!isFreeService) {
                statsMap[key].success += validMsgCount;
            }
        } else {
            statsMap[key].failed += 1;
        }
    });

    for (const key in statsMap) {
        const stat = statsMap[key];
        await DailyStat.findOneAndUpdate(
            { dateString: stat.dateString, userEmail: stat.userEmail },
            { $inc: { totalNumbers: stat.total, successOTP: stat.success, failedNumbers: stat.failed } },
            { upsert: true, new: true }
        );
    }

    // ডাটাবেস ক্লিন! ফেইলগুলো সাথে সাথে ডিলিট, সাকসেসগুলো ৭ দিন পর ডিলিট
    const deletedFailed = await Order.deleteMany({
        createdAt: { $lt: new Date(todayStrBD + "T00:00:00.000Z") },
        status: { $nin: ["DONE", "Success", "SUCCESS"] }
    });

    const deletedSuccess = await Order.deleteMany({
        createdAt: { $lt: sevenDaysAgo },
        status: { $in: ["DONE", "Success", "SUCCESS"] }
    });

    return NextResponse.json({
        success: true,
        message: "✅ Database Backup & Cleanup Successful! (Double-Count Fixed)",
        backupSaved: Object.keys(statsMap).length,
        deletedFailedOrders: deletedFailed.deletedCount,
        deletedSuccessOrders: deletedSuccess.deletedCount
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}