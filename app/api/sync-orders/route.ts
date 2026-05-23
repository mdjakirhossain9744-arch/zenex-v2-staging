import { NextResponse } from "next/server";
import mongoose from "mongoose"; // 💥 NEW: Interceptor-এর জন্য mongoose ইম্পোর্ট করা হলো 💥
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: Date | number | string = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

// 💥 THE ULTIMATE SMART OTP EXTRACTOR 💥
const extractStrictOTP = (msg: string) => {
    if (!msg) return "";
    const match = msg.match(/(?:\b\d{4,8}\b)|(?:\b\d{3}[\s-]\d{3,4}\b)|(?:G-\d{6,8})/i);
    return match ? match[0] : msg.trim();
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    
    // 💥 THE INTERCEPTOR (কাঁচা ডাটা চোর) 💥
    // প্রোভাইডার সার্ভারে যা পাঠাবে, তার হুবহু অরিজিনাল কপি ডাটাবেস প্রসেসিংয়ের আগেই এখানে সেভ হবে!
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection('mnit_raw_logs').insertOne({
            timestamp: new Date(),
            rawPayload: body
        });
      }
    } catch (logErr) {
      console.error("Failed to save raw log:", logErr);
    }

    // 💥 filterStatus রিসিভ করা হলো এবং limit ডিফল্ট 30 করা হলো 💥
    const { action, email, orderData, page = 1, limit = 30, targetDate, filterStatus } = body; 

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    if (action === "FETCH") {
      const todayStr = getUTCDateString();
      const fetchDate = targetDate || todayStr;

      // Timeout Logic
      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      await Order.updateMany(
        { userEmail: email, status: "WAIT", createdAt: { $lt: twentyMinsAgo } },
        { $set: { status: "FAIL", otp: "Timeout", expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } }
      );

      // 💥 ENTERPRISE SERVER-SIDE FILTERING QUERY 💥
      const query: any = { userEmail: email, dateString: fetchDate };
      
      // ফ্রন্টএন্ড থেকে যদি নির্দিষ্ট ট্যাবে (DONE, WAIT, FAIL) ক্লিক করে, তাহলে কুয়েরিতে সেটা অ্যাড হবে
      if (filterStatus && filterStatus !== "ALL") {
          query.status = filterStatus;
      }

      const skip = (page - 1) * limit;
      
      // 💥 শুধুমাত্র ফিল্টার করা ডাটার পরিমাণ কাউন্ট করবে 💥
      const totalItems = await Order.countDocuments(query);
      
      // 💥 গুনে গুনে ঠিক 30 টি ডাটা আনবে 💥
      let rawOrders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
      
      let orders = [...rawOrders];

      // 🛑 MAJOR FIX: Page 1 এ "সব DONE ডাটা একসাথে" আনার ভয়ংকর লজিকটি রিমুভ করা হয়েছে। 
      // এখন সার্ভার সাইড পেজিনেশন থাকায় কোনো প্যানেল হ্যাং বা ক্র্যাশ হবে্বর না! 🛑

      const finalOrders: any[] = [];
      let stats = { total: 0, success: 0, wait: 0, fail: 0 };

      // 💥 STATS QUERY: স্ট্যাটাস সবসময় ALL ডাটার উপর ভিত্তি করে হিসাব হবে, যাতে টপ বারের সংখ্যা ঠিক থাকে 💥
      const statQuery = { userEmail: email, dateString: fetchDate };

      if (fetchDate === todayStr) {
          const doneOrders = await Order.find({ ...statQuery, status: "DONE" }).select("fullMessage").lean();
          let actualOtpCount = 0;
          doneOrders.forEach((o: any) => {
               const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
               // 💥 FIX: Set() রিমুভ করে দিয়েছি যাতে একই কোড ২বার আসলে টপ বারে ২বারই সাকসেস কাউন্ট হয় 💥
               actualOtpCount += msgArray.length > 0 ? msgArray.length : 1;
          });

          stats = {
              total: await Order.countDocuments(statQuery),
              success: actualOtpCount, 
              wait: await Order.countDocuments({ ...statQuery, status: "WAIT" }),
              fail: await Order.countDocuments({ ...statQuery, status: "FAIL" }),
          };
      } else {
          const dailyStat = await DailyStat.findOne({ userEmail: email, dateString: fetchDate }).lean();
          if (dailyStat) {
              stats = {
                  total: dailyStat.totalNumbers || 0,
                  success: dailyStat.successOTP || 0,
                  wait: 0, 
                  fail: dailyStat.failedNumbers || dailyStat.failed || 0,
              };
          } else {
              stats = {
                  total: await Order.countDocuments(statQuery),
                  success: await Order.countDocuments({ ...statQuery, status: "DONE" }),
                  wait: 0,
                  fail: await Order.countDocuments({ ...statQuery, status: "FAIL" }),
              };
          }
      }

      orders.forEach((o: any) => {
        const msgArray: string[] = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
        if (o.status === "DONE" && msgArray.length > 1) {
          msgArray.forEach((msg: string, index: number) => {
            const extractedOtp = extractStrictOTP(msg); 
            
            finalOrders.push({
              // 💥 UNIQUE ID: _0, _1 যুক্ত করা হলো যাতে একই ওটিপি হলেও হাইড না হয় 💥
              id: `${o._id.toString()}_${index}`,
              dateString: o.dateString, displayNumber: o.displayNumber, searchNumber: o.searchNumber,
              country: o.country, operator: o.operator, status: o.status, otp: extractedOtp,
              fullMessage: msg, seenMessages: msgArray, isDup: index > 0, isMulti: true, 
              createdAt: new Date(o.createdAt).getTime(), receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
            });
          });
        } else {
          finalOrders.push({
            id: o._id.toString(), dateString: o.dateString, displayNumber: o.displayNumber,
            searchNumber: o.searchNumber, country: o.country, operator: o.operator, status: o.status,
            otp: o.otp, fullMessage: o.fullMessage, seenMessages: msgArray, isDup: false, isMulti: false,
            createdAt: new Date(o.createdAt).getTime(), receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
          });
        }
      });

      finalOrders.sort((a, b) => b.createdAt - a.createdAt);

      // 💥 FIXED PAGINATION LOGIC 💥
      const hasMoreData = rawOrders.length === limit;

      return NextResponse.json({ 
        success: true, 
        orders: finalOrders,
        pagination: { total: totalItems, page, limit, hasMore: hasMoreData },
        stats 
      });
    }

    if (action === "CREATE") {
      const todayStr = getUTCDateString();
      const newOrder = new Order({
        userEmail: email, searchNumber: orderData.searchNumber, displayNumber: orderData.displayNumber,
        country: orderData.country, operator: orderData.operator, status: orderData.status,
        otp: orderData.otp, fullMessage: orderData.fullMessage, 
        dateString: todayStr, 
        expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      });
      await newOrder.save();
      return NextResponse.json({ success: true });
    }

    if (action === "UPDATE") {
      const existingOrder = await Order.findOne({ searchNumber: orderData.searchNumber, userEmail: email });
      if (!existingOrder) return NextResponse.json({ success: false, message: "Order not found" });

      if (orderData.status === "FAIL" || orderData.status === "CANCEL") {
        existingOrder.status = "FAIL";
        existingOrder.otp = orderData.otp || "Timeout"; 
        existingOrder.expireAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
        await existingOrder.save();
        return NextResponse.json({ success: true, message: "Order failed due to timeout." });
      }

      if (orderData.status === "DONE" || orderData.otp) {
        const orderAgeMs = Date.now() - new Date(existingOrder.createdAt).getTime();
        if (orderAgeMs > 20 * 60 * 1000) { 
            await Order.updateOne({ _id: existingOrder._id }, { $set: { status: "FAIL", otp: "Timeout" } });
            return NextResponse.json({ success: false, message: "Order expired. MNIT validity over." });
        }

        if (existingOrder.status === "FAIL" || existingOrder.status === "CANCEL") {
            return NextResponse.json({ success: false, message: "Order was already cancelled or failed." });
        }

        const freshOrder = await Order.findById(existingOrder._id);
        const incomingMsg = (orderData.fullMessage || "").trim();
        if (!incomingMsg) return NextResponse.json({ success: false, message: "Empty message" });

        // 💥 THE MAGIC KEY (NID) - API Glitch Preventer 💥
        const incomingNid = orderData.nid || null;

        // যদি NID থাকে এবং সেটি আগেই ঢুকে থাকে, সাথে সাথে গ্লিচ হিসেবে ব্লক!
        if (incomingNid && freshOrder.receivedNids?.includes(incomingNid)) {
            return NextResponse.json({ success: true, message: "API Glitch Blocked! NID already processed." });
        }

        const currentMsg = freshOrder.fullMessage || "";
        const incomingCode = extractStrictOTP(incomingMsg); 

        const currentMsgsArray = currentMsg ? currentMsg.split(" _||_ ") : [];
        
        // 💥 RegExp এবং existingCodes.includes রিমুভ করা হলো যাতে Real Exact OTP ঢুকতে পারে 💥

        if (currentMsgsArray.length >= 50) { 
          return NextResponse.json({ success: true, message: "Max safety limit reached." });
        }

        const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || 
                              incomingMsg.toLowerCase().includes("telegram") || 
                              incomingMsg.toLowerCase().includes("t.me");

        let currentOtpCost = 0;
        let currentOtpCommission = 0;
        let agentToUpdate = null;

        if (!isFreeService) {
          const user = await User.findOne({ email });
          if (user) {
            currentOtpCost = Number(user.otpRate) || 0.50;
            if (user.agentEmail) {
              agentToUpdate = await User.findOne({
                $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                role: "agent"
              });
              if (agentToUpdate) {
                const agentRate = Number(agentToUpdate.agentMaxRate) || 0.70;
                const comm = Number((agentRate - currentOtpCost).toFixed(2));
                if (comm > 0) currentOtpCommission = comm;
              }
            }
          }
        }

        // 💥 ULTIMATE DB-LEVEL ATOMIC LOCK 💥
        // মঙ্গোডিবি চেক করবে এই NID টা ডাটাবেসে আছে কিনা, না থাকলে তবেই আপডেট করবে (Race Condition 100% Locked)
        const updateQuery = incomingNid 
              ? { _id: existingOrder._id, receivedNids: { $ne: incomingNid } } 
              : { _id: existingOrder._id, fullMessage: currentMsg };

        const updateData: any = {
            $set: {
              fullMessage: currentMsg ? currentMsg + " _||_ " + incomingMsg : incomingMsg,
              otp: incomingCode, 
              status: "DONE",
              expireAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
            },
            $inc: { orderCost: currentOtpCost, orderCommission: currentOtpCommission }
        };

        // যদি NID থাকে, তাহলে সেটা ডাটাবেসে পুশ করে রাখো
        if (incomingNid) {
            updateData.$push = { receivedNids: incomingNid };
        }

        const updatedOrder = await Order.findOneAndUpdate(updateQuery, updateData, { new: true });

        // 💥 গ্লিচ ডিটেক্ট হলে এখান থেকে ব্লক হয়ে যাবে, কোনো ব্যালেন্স এড হবে না! 💥
        if (!updatedOrder) {
          return NextResponse.json({ success: true, message: "Race condition locked. Glitch / Duplicate NID safely ignored!" });
        }

        if (currentOtpCost > 0) {
          await User.updateOne({ email }, { $inc: { balance: currentOtpCost } });
        }
        if (currentOtpCommission > 0 && agentToUpdate) {
          await User.updateOne(
            { _id: agentToUpdate._id }, 
            { $inc: { agentEarning: currentOtpCommission, balance: currentOtpCommission } }
          );
        }

        return NextResponse.json({ success: true, message: "Real OTP Processed successfully!" });
      }
    }
    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}