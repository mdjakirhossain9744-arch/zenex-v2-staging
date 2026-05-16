import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

// 💥 STRICT UTC TIMEZONE 💥
const getUTCDateString = (dateObj: Date | number | string = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    const { action, email, orderData, page = 1, limit = 50, targetDate } = body; 

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    if (action === "FETCH") {
      const skip = (page - 1) * limit;
      const totalItems = await Order.countDocuments({ userEmail: email });
      const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 }).skip(skip).limit(limit);
      
      const finalOrders: any[] = [];
      const todayStr = getUTCDateString();
      const fetchDate = targetDate || todayStr;

      const statQuery = { userEmail: email, dateString: fetchDate };
      const stats = {
          total: await Order.countDocuments(statQuery),
          success: await Order.countDocuments({ ...statQuery, status: "DONE" }),
          wait: await Order.countDocuments({ ...statQuery, status: "WAIT" }),
          fail: await Order.countDocuments({ ...statQuery, status: "FAIL" }),
      };

      orders.forEach((o: any) => {
        if (o.dateString !== todayStr && o.status !== "DONE") {
            return; 
        }

        const msgArray: string[] = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
        if (o.status === "DONE" && msgArray.length > 1) {
          msgArray.forEach((msg: string, index: number) => {
            const codeMatch = msg.match(/\b\d{4,8}\b/);
            const extractedOtp = codeMatch ? codeMatch[0] : msg;
            
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

      return NextResponse.json({ 
        success: true, 
        orders: finalOrders,
        pagination: { total: totalItems, page, limit, hasMore: (skip + orders.length) < totalItems },
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
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
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
        existingOrder.expireAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await existingOrder.save();
        return NextResponse.json({ success: true, message: "Order failed due to timeout." });
      }

      if (orderData.status === "DONE" || orderData.otp) {
        const orderAgeMs = Date.now() - new Date(existingOrder.createdAt).getTime();
        if (orderAgeMs > 25 * 60 * 1000) { 
            await Order.updateOne({ _id: existingOrder._id }, { $set: { status: "FAIL", otp: "Timeout" } });
            return NextResponse.json({ success: false, message: "Order expired. MNIT validity over." });
        }

        if (existingOrder.status === "FAIL" || existingOrder.status === "CANCEL") {
            return NextResponse.json({ success: false, message: "Order was already cancelled or failed." });
        }

        const freshOrder = await Order.findById(existingOrder._id);
        const incomingMsg = (orderData.fullMessage || "").trim();
        const currentMsg = freshOrder.fullMessage || "";

        const incomingMatch = incomingMsg.match(/\b\d{4,8}\b/);
        const incomingCode = incomingMatch ? incomingMatch[0] : incomingMsg.trim();

        const currentMsgsArray = currentMsg ? currentMsg.split(" _||_ ") : [];
        const existingCodes = currentMsgsArray.map((msg: string) => {
            const match = msg.match(/\b\d{4,8}\b/);
            return match ? match[0] : msg.trim();
        });

        if (existingCodes.includes(incomingCode)) {
          return NextResponse.json({ success: true, message: "Duplicate Exact OTP code detected. Ignored." });
        }

        if (currentMsgsArray.length >= 50) { 
          return NextResponse.json({ success: true, message: "Max safety limit reached." });
        }

        const updatedOrder = await Order.findOneAndUpdate(
          { _id: existingOrder._id, fullMessage: currentMsg }, 
          { 
            $set: {
              fullMessage: currentMsg ? currentMsg + " _||_ " + incomingMsg : incomingMsg,
              otp: orderData.otp,
              status: "DONE",
              expireAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
            }
          },
          { new: true }
        );

        if (!updatedOrder) {
          return NextResponse.json({ success: false, message: "Race condition locked. Retrying..." });
        }

        const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || 
                              incomingMsg.toLowerCase().includes("telegram") || 
                              incomingMsg.toLowerCase().includes("t.me");

        if (!isFreeService) {
          const user = await User.findOne({ email });
          if (user) {
            const userRate = Number(user.otpRate) || 0.50;
            
            await User.findOneAndUpdate({ email }, { $inc: { balance: userRate } });

            if (user.agentEmail) {
              const agent = await User.findOne({
                $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                role: "agent"
              });

              if (agent) {
                const agentRate = Number(agent.agentMaxRate) || 0.70;
                const commission = Number((agentRate - userRate).toFixed(2));

                if (commission > 0) {
                  await User.findOneAndUpdate(
                     { _id: agent._id }, 
                     { $inc: { agentEarning: commission, balance: commission } }
                  );
                }
              }
            }
          }
        }

        return NextResponse.json({ success: true, message: "Different OTP Processed successfully!" });
      }
    }
    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}