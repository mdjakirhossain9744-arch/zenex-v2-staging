import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "🔴 403 FORBIDDEN: Endpoint Disabled for Security." }, 
    { status: 403 }
  );
}