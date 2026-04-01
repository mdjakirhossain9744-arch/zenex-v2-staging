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

    // 💥 ১. ডাটাবেস থেকে সব নাম্বার টেনে আনা (MULTI সাপোর্ট সহ) 💥
    if (action === "FETCH") {
      const orders = await Order.find({ userEmail: email }).sort({ createdAt: -1 }).limit(200);
      
      const mappedOrders = orders.map((o) => {
        // ডাটাবেস থেকে একাধিক মেসেজ আলাদা করা হচ্ছে (MULTI লজিক)
        const msgArray = o.fullMessage ? o.fullMessage.split(" _||_ ") : [];
        
        return {
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
          isDup: msgArray.length > 1, // ফ্রন্টএন্ডের পুরনো কোড সাপোর্ট করার জন্য
          isMulti: msgArray.length > 1, // 💥 নতুন MULTI লজিক 💥
          createdAt: new Date(o.createdAt).getTime(),
          receivedAt: o.updatedAt ? new Date(o.updatedAt).getTime() : null
        };
      });

      return NextResponse.json({ success: true, orders: mappedOrders });
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

      // যদি OTP আসে এবং স্ট্যাটাস DONE হয়
      if (orderData.status === "DONE" || orderData.otp) {
        
        const incomingMsg = (orderData.fullMessage || "").trim();
        const currentMsg = existingOrder.fullMessage || "";

        // 🛡️ গ্লিচ প্রটেকশন: হুবহু একই মেসেজ ২ বার আসলে ব্লক করবে (কিন্তু নতুন মেসেজ আসলে অ্যালাউ করবে)
        if (incomingMsg && currentMsg.includes(incomingMsg)) {
          return NextResponse.json({ success: true, message: "Already processed this exact OTP text." });
        }

        // 🛡️ হ্যাকার প্রটেকশন: লিমিট বাড়িয়ে ৫০ করা হলো (যাতে রিয়েল ইউজাররা আনলিমিটেড কোড নিতে পারে)
        const msgCount = currentMsg ? currentMsg.split(" _||_ ").length : 0;
        if (msgCount >= 5) {
          return NextResponse.json({ success: true, message: "Max safety limit (50) reached for this number." });
        }

        // 💥 যদি উপরের ফিল্টারে না আটকায়, তারমানে এটি একটি সম্পূর্ণ নতুন কোড! 💥

        // ১. WhatsApp এবং Telegram চেক করা হচ্ছে (লস ঠেকানোর জন্য)
        const isFreeService = incomingMsg.toLowerCase().includes("whatsapp") || 
                              incomingMsg.toLowerCase().includes("wa.me") || 
                              incomingMsg.toLowerCase().includes("telegram") || 
                              incomingMsg.toLowerCase().includes("t.me");

        if (!isFreeService) {
          // যদি ফ্রী সার্ভিস না হয়, তবে ইউজারের ব্যালেন্স অ্যাড হবে
          const user = await User.findOne({ email });
          if (user) {
            const userRate = Number(user.otpRate) || 0.50;
            user.balance = Number((Number(user.balance || 0) + userRate).toFixed(2));
            await user.save();

            // এজেন্টের অটো-কমিশন হিসাব
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
                  await agent.save();
                }
              }
            }
          }
        }

        // ২. ডাটাবেসে নতুন মেসেজটি যুক্ত করা হচ্ছে (আগের মেসেজগুলো ডিলিট না করে)
        existingOrder.fullMessage = currentMsg ? currentMsg + " _||_ " + incomingMsg : incomingMsg;
        existingOrder.otp = orderData.otp; // সর্বশেষ কোডটি আপডেট করা হলো
        existingOrder.status = "DONE";
        await existingOrder.save();

        return NextResponse.json({ 
          success: true, 
          message: isFreeService 
            ? "New OTP processed. No balance added for WhatsApp/Telegram." 
            : `New MULTI OTP (${msgCount + 1}) processed, Balance & Commission added!` 
        });

      } else {
        // যদি স্ট্যাটাস CANCEL হয়
        existingOrder.status = orderData.status;
        await existingOrder.save();
        return NextResponse.json({ success: true });
      }
    }

    return NextResponse.json({ success: false, message: "Invalid action" });
  } catch (error) {
    console.error("Sync Order API Error:", error);
    return NextResponse.json({ success: false, message: "Database Error" }, { status: 500 });
  }
}