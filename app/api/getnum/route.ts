import { NextResponse } from "next/server";

// Vercel ক্যাশ যেন না ধরে তার জন্য
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { range, is_national, remove_plus } = body;

    const API_KEY = "M_7VX25KAJI";

    // 💥 Vercel 500 Error ফিক্স: ক্লাউডফ্লেয়ার বাইপাস করার জন্য হেডার যুক্ত করা হলো 💥
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
      method: "POST",
      headers: {
        "mapikey": API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        range: range || "23276345XXX",
        is_national: is_national || false,
        remove_plus: remove_plus || false,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
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