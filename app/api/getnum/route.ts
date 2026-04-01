import { NextResponse } from "next/server";

// Vercel ক্যাশ যেন না ধরে তার জন্য
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { range, is_national, remove_plus } = body;

    const API_KEY = "M_7VX25KAJI";

    // 💥 Cloudflare / WAF Bypass (Android Mobile App Dalvik Trick) 💥
    // আমরা প্রোভাইডারকে বোঝানোর চেষ্টা করছি যে রিকোয়েস্টটি একটি অ্যান্ড্রয়েড মোবাইল অ্যাপ থেকে আসছে
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
      method: "POST",
      headers: {
        "mapikey": API_KEY,
        "Content-Type": "application/json",
        "User-Agent": "Dalvik/2.1.0 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016)", // ফেইক অ্যান্ড্রয়েড ডিভাইস
        "Accept": "application/json",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({
        range: range || "23276345XXX",
        is_national: is_national || false,
        remove_plus: remove_plus || false,
      }),
      cache: "no-store",
    });

    // যদি প্রোভাইডার 403 বা অন্য কোনো এরর দেয়, তবে কনসোলে লগ করবে যেন Vercel থেকে দেখা যায়
    if (!response.ok) {
       const errorText = await response.text(); 
       console.error(`Provider Error [${response.status}]:`, errorText);
       return NextResponse.json({ error: `Provider Blocked Request (Status: ${response.status})` }, { status: 400 });
    }

    const data = await response.json();

    if (data.meta?.status !== "success") {
      return NextResponse.json(
        { error: data.message || "Failed to get number from API" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data.data,
    });

  } catch (error: any) {
    console.error("Get Number API Error:", error.message);
    return NextResponse.json(
      { error: "Internal Server Error or Provider Timeout" },
      { status: 500 }
    );
  }
}