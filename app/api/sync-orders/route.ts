import { NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order";
import User from "../../../models/User";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await connectToDatabase();
    const body = await req.json().catch(() => ({}));
    const { action, email, orderData } = body;

    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required" }, { status: 400 });
    }

    if (action === "FETCH") {
      const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 }).limit(200);
      const finalOrders: any[] = [];

      orders.forEach((o: any) => {
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
      return NextResponse.json({ success: true, orders: finalOrders });
    }

    if (action === "CREATE") {
      const newOrder = new Order({
        userEmail: email, searchNumber: orderData.searchNumber, displayNumber: orderData.displayNumber,
        country: orderData.country, operator: orderData.operator, status: orderData.status,
        otp: orderData.otp, fullMessage: orderData.fullMessage, dateString: orderData.dateString
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
        await existingOrder.save();
        return NextResponse.json({ success: true, message: "Order failed due to timeout." });
      }

      if (orderData.status === "DONE" || orderData.otp) {
        
        // 💥 Race Condition এড়াতে ফ্রেশ ডাটা আনা হচ্ছে 💥
        const freshOrder = await Order.findById(existingOrder._id);
        const incomingMsg = (orderData.fullMessage || "").trim();
        const currentMsg = freshOrder.fullMessage || "";

        if (incomingMsg && currentMsg.includes(incomingMsg)) {
          return NextResponse.json({ success: true, message: "Already processed this exact OTP text." });
        }

        const msgCount = currentMsg ? currentMsg.split(" _||_ ").length : 0;
        if (msgCount >= 50) { 
          return NextResponse.json({ success: true, message: "Max safety limit reached." });
        }

        const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || 
                              incomingMsg.toLowerCase().includes("telegram") || 
                              incomingMsg.toLowerCase().includes("t.me");

        if (!isFreeService) {
          const user = await User.findOne({ email });
          if (user) {
            const userRate = Number(user.otpRate) || 0.50;
            
            // 💥 Atomic Operation ($inc) দিয়ে ব্যালেন্স যোগ (১০০% সিকিউর) 💥
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
                  // 💥 এজেন্টের ব্যালেন্সও Atomic Operation দিয়ে যোগ করা হলো 💥
                  await User.findOneAndUpdate(
                     { _id: agent._id }, 
                     { $inc: { agentEarning: commission, balance: commission } }
                  );
                }
              }
            }
          }
        }

        freshOrder.fullMessage = currentMsg ? currentMsg + " _||_ " + incomingMsg : incomingMsg;
        freshOrder.otp = orderData.otp; 
        freshOrder.status = "DONE";
        await freshOrder.save();

        return NextResponse.json({ success: true, message: "Processed successfully!" });
      }
    }
    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}