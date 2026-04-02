import { NextResponse } from "next/server";

export async function GET() {
  const response = NextResponse.json({ success: true, message: "Logout Successful" });
  
  // 💥 ম্যাজিক: ব্রাউজার থেকে zenex_token কুকি চিরতরে ধ্বংস করে দেওয়া হচ্ছে 💥
  response.cookies.set("zenex_token", "", {
    httpOnly: true,
    expires: new Date(0), // ডেট জিরো করে দেওয়া মানে কুকি ডিলিট
    path: "/",
  });

  return response;
}