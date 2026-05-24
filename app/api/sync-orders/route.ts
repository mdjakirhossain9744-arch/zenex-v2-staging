import { NextResponse } from "next/server";
import mongoose from "mongoose"; 
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";
import DailyStat from "../../../models/DailyStat";

export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: Date | number | string = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

const extractStrictOTP = (msg: string) => {
    if (!msg) return "";
    const match = msg.match(/(?:\b\d{4,8}\b)|(?:\b\d{3}[\s-]\d{3,4}\b)|(?:G-\d{6,8})/i);
    return match ? match[0] : msg.trim();
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    
    // 💥 THE INTERCEPTOR (Raw Data Tracker) 💥
    try {
      const RawLog = mongoose.models.mnit_raw_logs || mongoose.model("mnit_raw_logs", new mongoose.Schema({
          timestamp: { type: Date, default: Date.now },
          rawPayload: { type: Object }
      }, { strict: false }));
      await RawLog.create({ rawPayload: body });
    } catch (logErr) {}

    const { action, email, orderData, page = 1, limit = 30, targetDate, filterStatus } = body; 

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    if (action === "FETCH") {
      const todayStr = getUTCDateString();
      const fetchDate = targetDate || todayStr;

      const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
      await Order.updateMany(
        { userEmail: email, status: "WAIT", createdAt: { $lt: twentyMinsAgo } },
        { $set: { status: "FAIL", otp: "Timeout", expireAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) } }
      );

      const query: any = { userEmail: email, dateString: fetchDate };
      
      if (filterStatus && filterStatus !== "ALL") {
          query.status = filterStatus;
      }

      const skip = (page - 1) * limit;
      const totalItems = await Order.countDocuments(query);
      
      let rawOrders = await Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
      let orders = [...rawOrders];

      const finalOrders: any[] = [];
      let stats = { total: 0, success: 0, wait: 0, fail: 0 };

      const statQuery = { userEmail: email, dateString: fetchDate };

      if (fetchDate === todayStr) {
          const doneOrders = await Order.find({ ...statQuery, status: "DONE" }).select("fullMessage").lean();
          let actualOtpCount = 0;
          doneOrders.forEach((o: any) => {
               const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
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
            return NextResponse.json({ success: false, message: "Order expired." });
        }

        if (existingOrder.status === "FAIL" || existingOrder.status === "CANCEL") {
            return NextResponse.json({ success: false, message: "Order was already cancelled or failed." });
        }

        const freshOrder = await Order.findById(existingOrder._id);
        const incomingMsg = (orderData.fullMessage || "").trim();
        if (!incomingMsg) return NextResponse.json({ success: false, message: "Empty message" });

        // 💥 ENTERPRISE ANTI-GLITCH LOCK (Timestamp & Time-Gap Based) 💥
        const incomingTimestamp = orderData.receivedAt ? String(orderData.receivedAt) : null;
        
        // লক ১: হুবহু একই টাইমস্ট্যাম্প পেলে সাথে সাথে গ্লিচ হিসেবে ব্লক! 
        if (incomingTimestamp && freshOrder.receivedNids?.includes(incomingTimestamp)) {
            return NextResponse.json({ success: true, message: "API Glitch Blocked! Exact same SMS timestamp already processed." });
        }

        const currentMsg = freshOrder.fullMessage || "";
        const currentMsgsArray = currentMsg ? currentMsg.split(" _||_ ") : [];
        const lastStoredMsg = currentMsgsArray[currentMsgsArray.length - 1];

        // লক ২: ৫ সেকেন্ডের টাইম-গ্যাপ লক (ফলব্যাক)
        // যদি ফ্রন্টএন্ড কোনো কারণে টাইমস্ট্যাম্প ছাড়াই ডাবল কল মারে, তাহলে ৫ সেকেন্ডের আগে আসা সেম মেসেজকে ব্লক করবে।
        const timeSinceLastUpdate = Date.now() - new Date(freshOrder.updatedAt).getTime();
        if (incomingMsg === lastStoredMsg && timeSinceLastUpdate < 5000) {
            return NextResponse.json({ success: true, message: "Network Glitch Blocked! Same message arrived too fast (< 5s)." });
        }

        const incomingCode = extractStrictOTP(incomingMsg); 

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

        // 💥 DB Update Query 💥
        const updateQuery = incomingTimestamp 
              ? { _id: existingOrder._id, receivedNids: { $ne: incomingTimestamp } } 
              : { _id: existingOrder._id };

        const updateData: any = {
            $set: {
              fullMessage: currentMsg ? currentMsg + " _||_ " + incomingMsg : incomingMsg,
              otp: incomingCode, 
              status: "DONE",
              expireAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
            },
            $inc: { orderCost: currentOtpCost, orderCommission: currentOtpCommission }
        };

        if (incomingTimestamp) {
            updateData.$push = { receivedNids: incomingTimestamp };
        }

        const updatedOrder = await Order.findOneAndUpdate(updateQuery, updateData, { new: true });

        if (!updatedOrder) {
          return NextResponse.json({ success: true, message: "Race condition locked safely!" });
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