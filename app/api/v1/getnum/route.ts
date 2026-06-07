import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ meta: { status: "error" }, message: "🚀 API Upgraded! Use api.yourdomain.com" }, { status: 403 });
}