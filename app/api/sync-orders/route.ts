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

    // 💥 ১. ডাটাবেস থেকে সব নাম্বার টেনে আনা (Visual Bug Fixed) 💥
    if (action === "FETCH") {
      const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 }).limit(200);
      
      const finalOrders: any[] = [];

      orders.forEach((o) => {
        const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
        
        // 💥 যদি মাল্টি ওটিপি হয়, তবে ডাটাবেসের ১টি রো-কে ভেঙে আলাদা আলাদা কার্ড বানানো হচ্ছে 💥
        if (o.status === "DONE" && msgArray.length > 1) {
          msgArray.forEach((msg, index) => {
            const codeMatch = msg.match(/\b\d{4,8}\b/);
            const extractedOtp = codeMatch ? codeMatch[0] : msg;

            finalOrders.push({
              id: `${o._id.toString()}_${index}`, // ইউনিক আইডি
              dateString: o.dateString,
              displayNumber: o.displayNumber,
              searchNumber: o.searchNumber,
              country: o.country,
              operator: o.operator,
              status: o.status,
              otp: extractedOtp,
              fullMessage: msg,
              seenMessages: msgArray, 
              isDup: index > 0, 
              isMulti: true, 
              createdAt: new Date(o.createdAt).getTime(),
              receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
            });
          });
        } else {
          // সিঙ্গেল ওটিপি বা ওয়েটিং/ফেইলড নাম্বার
          finalOrders.push({
            id: o._id.toString(),
            dateString: o.dateString,
            displayNumber: o.displayNumber,
            searchNumber: o.searchNumber,
            country: o.country,
            operator: o.operator,
            status: o.status,
            otp: o.otp,
            fullMessage: o.fullMessage,
            seenMessages: msgArray,
            isDup: false,
            isMulti: false,
            createdAt: new Date(o.createdAt).getTime(),
            receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
          });
        }
      });

      return NextResponse.json({ success: true, orders: finalOrders });
    }

    // 💥 ২. ম্যানুয়ালি নাম্বার নিলে সেটা ডাটাবেসে সেভ করা 💥
    if (action === "CREATE") {
      const newOrder = new Order({
        userEmail: email,
        searchNumber: orderData.searchNumber,
        displayNumber: orderData.displayNumber,
        country: orderData.country,
        operator: orderData.operator,
        status: orderData.status,
        otp: orderData.otp,
        fullMessage: orderData.fullMessage,
        dateString: orderData.dateString
      });
      await newOrder.save();
      return NextResponse.json({ success: true });
    }

    // 💥 ৩. ম্যাজিক: MULTI OTP, অটো-কমিশন ও অ্যান্টি-হ্যাক সিস্টেম 💥
    if (action === "UPDATE") {
      const existingOrder = await Order.findOne({ 
        searchNumber: orderData.searchNumber, 
        userEmail: email 
      });

      if (!existingOrder) {
        return NextResponse.json({ success: false, message: "Order not found" });
      }

      if (orderData.status === "FAIL" || orderData.status === "CANCEL") {
        existingOrder.status = "FAIL";
        existingOrder.otp = orderData.otp || "Timeout"; 
        await existingOrder.save();
        return NextResponse.json({ success: true, message: "Order failed due to timeout." });
      }

      if (orderData.status === "DONE" || orderData.otp) {
        
        const incomingMsg = (orderData.fullMessage || "").trim();
        const currentMsg = existingOrder.fullMessage || "";

        if (incomingMsg && currentMsg.includes(incomingMsg)) {
          return NextResponse.json({ success: true, message: "Already processed this exact OTP text." });
        }

        const msgCount = currentMsg ? currentMsg.split(" _||_ ").length : 0;
        if (msgCount >= 50) { 
          return NextResponse.json({ success: true, message: "Max safety limit (50) reached for this number." });
        }

        const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || 
                              incomingMsg.toLowerCase().includes("wa.me") || 
                              incomingMsg.toLowerCase().includes("telegram") || 
                              incomingMsg.toLowerCase().includes("t.me");

        if (!isFreeService) {
          const user = await User.findOne({ email });
          if (user) {
            const userRate = Number(user.otpRate) || 0.50;
            user.balance = Number((Number(user.balance || 0) + userRate).toFixed(2));
            await user.save();

            if (user.agentEmail) {
              const agent = await User.findOne({
                $or: [{ email: user.agentEmail }, { customAgentMail: user.agentEmail }],
                role: "agent"
              });

              if (agent) {
                const agentRate = Number(agent.agentMaxRate) || 0.70;
                const commission = Number((agentRate - userRate).toFixed(2));

                if (commission > 0) {
                  agent.agentEarning = Number((Number(agent.agentEarning || 0) + commission).toFixed(2));
                  agent.balance = Number((Number(agent.balance || 0) + commission).toFixed(2));
                  await agent.save();
                }
              }
            }
          }
        }

        existingOrder.fullMessage = currentMsg ? currentMsg + " _||_ " + incomingMsg : incomingMsg;
        existingOrder.otp = orderData.otp; 
        existingOrder.status = "DONE";
        await existingOrder.save();

        return NextResponse.json({ 
          success: true, 
          message: isFreeService 
            ? "New OTP processed. No balance added for WhatsApp/Telegram." 
            : `New MULTI OTP (${msgCount + 1}) processed, Balance & Commission added!` 
        });

      }
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    console.error("Sync Order API Error:", error);
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}