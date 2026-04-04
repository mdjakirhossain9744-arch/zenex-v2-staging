import { NextResponse, NextRequest } from "next/server";
// 💥 MAGIC FIX: Import paths fixed perfectly!
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
    // 🛡️ HACKER PROTECTION: সিক্রেট পাসওয়ার্ড চেক! 🛡️
    const searchParams = req.nextUrl.searchParams;
    const secretKey = searchParams.get("key");

    if (secretKey !== "ZENEX_CLEANUP_2026") {
      return NextResponse.json({ message: "🔴 UNAUTHORIZED: Access Denied!" }, { status: 403 });
    }

    await connectToDatabase();

    const todayStrBD = getBDDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // ১. গতকাল বা তার আগের সব ডাটা খোঁজো
    const oldOrders = await Order.find({
        createdAt: { $lt: new Date(todayStrBD + "T00:00:00.000Z") }
    }).lean();

    const statsMap: Record<string, any> = {};

    oldOrders.forEach((o: any) => {
        const oDate = getBDDateString(o.createdAt || new Date(o.dateString));
        const uEmail = (o.userEmail || o.email || "").toLowerCase().trim();
        const key = `${oDate}_${uEmail}`;

        if (!statsMap[key]) {
            statsMap[key] = { dateString: oDate, userEmail: uEmail, total: 0, success: 0, failed: 0 };
        }

        const msgCount = o.fullMessage ? o.fullMessage.split(" _||_ ").length : 1;
        statsMap[key].total += msgCount;

        if (o.status === "DONE" || o.status === "Success" || o.status === "SUCCESS") {
            statsMap[key].success += msgCount;
        } else {
            statsMap[key].failed += msgCount;
        }
    });

    // ২. ডায়েরিতে সেভ করো
    for (const key in statsMap) {
        const stat = statsMap[key];
        await DailyStat.findOneAndUpdate(
            { dateString: stat.dateString, userEmail: stat.userEmail },
            { $inc: { totalNumbers: stat.total, successOTP: stat.success, failedNumbers: stat.failed } },
            { upsert: true, new: true }
        );
    }

    // ৩. ডাটাবেস ক্লিন করো! 
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
        message: "✅ Database Backup & Cleanup Successful!",
        backupSaved: Object.keys(statsMap).length,
        deletedFailedOrders: deletedFailed.deletedCount,
        deletedSuccessOrders: deletedSuccess.deletedCount
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message });
  }
}