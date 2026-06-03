import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("zenex_token")?.value;
  const path = req.nextUrl.pathname;

  // 🛡️ 1. ENTERPRISE API FIREWALL (Anti-DDoS & Bot Security) 🛡️
  if (path.startsWith("/api/v1/")) {
    const apiKey = req.headers.get("mapikey");
    
    // 💥 TS Error Fixed: VPS/Nginx থেকে ক্লায়েন্টের আসল IP ধরার নিরাপদ উপায় 💥
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0] || "Unknown IP";
    
    // 💥 যদি mapikey না থাকে বা সাইজ ঠিক না থাকে, ডাটাবেস পর্যন্ত রিকোয়েস্ট যাবেই না! 💥
    if (!apiKey || apiKey.trim().length < 10) {
      console.warn(`🚨 Firewall Blocked Unauthorized Bot IP: ${clientIp}`);
      return NextResponse.json(
        { meta: { status: "error" }, message: "Access Denied: Missing or Invalid API Key. Server Protected by ZENEX Firewall." }, 
        { status: 401 }
      );
    }
    // সঠিক mapikey থাকলে ঢুকতে দেবে (বাকিটা v1 route.ts ফাইল চেক করবে)
    return NextResponse.next();
  }

  // 2. ওয়েবসাইটের নরমাল API গুলোতে কাউকে বাধা দেওয়া হবে না
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  // 3. 💥 ম্যাজিক: লগিন করা অবস্থায় /login বা /register এ গেলে সোজা ড্যাশবোর্ডে পাঠাবে! 💥
  if (path === "/login" || path === "/register") {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 4. যদি কোনো টোকেন/কুকি না থাকে, সরাসরি লগিন পেজে লাথি খাবে
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 5. 💥 SUPER ADMIN FIREWALL (Role Checking & Zero DB Load) 💥
  try {
    const payloadBase64 = token.split('.')[1];
    // Base64 ডিকোড করে পেলোড বের করা হচ্ছে
    const decodedPayload = JSON.parse(atob(payloadBase64));
    const userRole = decodedPayload.role; // admin, agent, or user

    // Admin Panel Protection
    if (path.startsWith("/admin") || path.startsWith("/users")) {
      if (userRole !== "admin") {
        console.warn(`🚨 Security Alert: Non-admin tried to access admin panel!`);
        return NextResponse.redirect(new URL("/", req.url)); 
      }
    }

    // Agent/Admin Panel Protection
    if (path.startsWith("/my-users")) {
      if (userRole !== "agent" && userRole !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

  } catch (error) {
    // 🚨 টোকেন টেম্পার বা করাপ্ট হলে কুকি ক্লিয়ার করে লগইন পেজে পাঠাবে
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete("zenex_token");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // 💥 API Firewall কাজ করার জন্য /api/:path* অ্যাড করা হলো 💥
    "/api/:path*", 
    "/", 
    "/login", 
    "/register",
    "/admin/:path*", 
    "/users/:path*", 
    "/console/:path*", 
    "/summary/:path*", 
    "/get-number/:path*", 
    "/payment/:path*", 
    "/profile/:path*", 
    "/my-users/:path*"
  ],
};