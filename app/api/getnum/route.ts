import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // ১. ক্লায়েন্ট (Get Number পেজ) থেকে পাঠানো রিকোয়েস্ট রিসিভ করা
    const body = await request.json();
    const { range, is_national, remove_plus } = body;

    // ২. তোমার আসল API Key (এটা সার্ভার সাইডে থাকবে, কেউ দেখতে পাবে না)
    const API_KEY = "M_7VX25KAJI";

    // ৩. MNIT Network এর সার্ভারে রিকোয়েস্ট পাঠানো
    const response = await fetch("https://x.mnitnetwork.com/mapi/v1/public/getnum/number", {
      method: "POST",
      headers: {
        "mapikey": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: range || "23276345XXX",
        is_national: is_national || false,
        remove_plus: remove_plus || false,
      }),
    });

    const data = await response.json();

    // ৪. যদি MNIT সার্ভার থেকে কোনো এরর আসে
    if (!response.ok || data.meta?.status !== "success") {
      return NextResponse.json(
        { error: data.message || "Failed to get number from API" },
        { status: 400 }
      );
    }

    // ৫. নাম্বার সফলভাবে পেলে ক্লায়েন্টের কাছে পাঠিয়ে দেওয়া
    return NextResponse.json({
      success: true,
      data: data.data,
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}