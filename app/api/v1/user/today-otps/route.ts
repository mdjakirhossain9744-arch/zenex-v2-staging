import { NextResponse } from "next/server";
import connectToDatabase from "../../../../lib/mongodb"; 
import User from "../../../../../models/User"; 
import Order from "../../../../../models/Order"; 

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, mapikey",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

const getUTCDateString = (dateObj: any = new Date()) => {
  return new Date(dateObj).toISOString().split('T')[0];
};

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("mapikey");
    if (!apiKey) return NextResponse.json({ error: "Invalid API Key" }, { status: 401, headers: corsHeaders });

    await connectToDatabase();
    const user = await User.findOne({ apiKey: apiKey.trim() }).select("email").lean();
    if (!user) return NextResponse.json({ error: "Invalid API Key" }, { status: 401, headers: corsHeaders });

    const todayStr = getUTCDateString();
    
    // 💥 SUPER OPTIMIZATION: শুধু displayNumber এবং otp মেমোরিতে আনা হবে (Zero Load) 💥
    const orders = await Order.find({
       userEmail: user.email,
       dateString: todayStr,
       status: "DONE"
    }).select("displayNumber otp -_id").lean();

    if (orders.length === 0) {
       return new NextResponse("NO_DATA", { status: 200, headers: corsHeaders });
    }

    const textData = orders.map((o: any) => {
       const cleanNum = String(o.displayNumber).replace(/\D/g, "");
       return `${cleanNum}|${o.otp}`;
    }).join('\n');

    return new NextResponse(textData, {
       status: 200,
       headers: { ...corsHeaders, "Content-Type": "text/plain" }
    });

  } catch (error: any) {
    return NextResponse.json({ error: "Server Error" }, { status: 500, headers: corsHeaders });
  }
}