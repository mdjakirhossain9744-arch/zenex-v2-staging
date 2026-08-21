// File Path: app/api/getnum/route.ts

import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "../../lib/mongodb";
import Order from "../../../models/Order"; 
import User from "../../../models/User";

export const dynamic = "force-dynamic";

const getUTCDateString = (dateObj: any = new Date()) => {
  try { return new Date(dateObj).toISOString().split('T')[0]; } 
  catch(e) { return new Date().toISOString().split('T')[0]; }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    let { range, email } = body; 

    if (!email) {
        const token = request.cookies.get("zenex_token")?.value;
        if (token) {
            try {
                const payloadBase64 = token.split('.')[1];
                const decodedPayload = JSON.parse(atob(payloadBase64));
                email = decodedPayload.email;
            } catch (e) {
                console.error("JWT Decode error in getnum");
            }
        }
    }

    if (!email) {
       return NextResponse.json({ error: "Unauthorized: User Session Expired or Email Missing" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findOne({ email: new RegExp(`^${email.trim()}$`, 'i') }).lean();
    if (!user || user.status !== "active") {
        return NextResponse.json({ error: "Account Inactive or Blocked" }, { status: 403 });
    }

    const rid = (range || "22501").replace(/x/gi, ''); 

    const CORE_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";

    const response = await fetch(`${CORE_API_URL}/v1/getnum`, {
      method: "POST",
      headers: {
        "mapikey": user.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ range: rid }),
      cache: "no-store",
    });

    if (!response.ok) {
       return NextResponse.json({ error: `Provider Blocked Request (Status: ${response.status})` }, { status: 400 });
    }

    const data = await response.json();

    if (data.meta?.code !== 200 || !data.data) {
      return NextResponse.json(
        { error: data.message || "Failed to get number from Provider. Out of Stock?" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
          copy: data.data.copy,
          full_number: data.data.full_number,
          number: data.data.number,
          country: data.data.country,
          iso: data.data.iso,
          operator: data.data.operator,
          status: data.data.status
      },
      orderId: null 
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error or Provider Timeout" },
      { status: 500 }
    );
  }
}