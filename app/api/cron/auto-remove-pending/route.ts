import { NextResponse } from "next/server";
import connectToDatabase from "../../../lib/mongodb";
import User from "../../../../models/User";
import Order from "../../../../models/Order";
import Notification from "../../../../models/Notification";
import Withdraw from "../../../../models/Withdraw";
import DailyStat from "../../../../models/DailyStat";

export async function GET(request: Request) {
  try {
    // 🔒 সিকিউরিটি: যাতে কেউ ব্রাউজার দিয়ে এই লিংকে ঢুকে স্ক্রিপ্ট রান না করতে পারে
    const { searchParams } = new URL(request.url);
    const secretKey = searchParams.get('secret');
    
    // আপনি আপনার পছন্দমতো একটি সিক্রেট কোড দিতে পারেন, যেমন: "zenex-super-secret-123"
    if (secretKey !== "ZENEX_AUTO_CLEANUP_2024") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    // ১০ দিন আগের তারিখ বের করা হচ্ছে
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // যেসব ইউজারের স্ট্যাটাস pending এবং তারা ১০ দিন আগে বা তার আগে জয়েন করেছে
    const pendingUsers = await User.find({
      status: 'pending',
      createdAt: { $lte: tenDaysAgo } // $lte মানে less than or equal (১০ দিন বা তার বেশি)
    });

    if (pendingUsers.length === 0) {
      return NextResponse.json({ message: "No pending users older than 10 days found." }, { status: 200 });
    }

    let deletedCount = 0;

    // একটি একটি করে ইউজারকে ডিলিট করা হচ্ছে
    for (const user of pendingUsers) {
      await Order.deleteMany({ userEmail: user.email });
      await Notification.deleteMany({ userEmail: user.email });
      await Withdraw.deleteMany({ email: user.email });
      await DailyStat.deleteMany({ userEmail: user.email });
      await User.deleteOne({ _id: user._id });
      deletedCount++;
    }

    console.log(`✅ AUTO-CLEANUP: ${deletedCount} pending users removed automatically.`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully removed ${deletedCount} pending users.` 
    }, { status: 200 });

  } catch (error: any) {
    console.error("AUTO_CLEANUP_ERROR:", error);
    return NextResponse.json({ message: "Server Error: " + error.message }, { status: 500 });
  }
}