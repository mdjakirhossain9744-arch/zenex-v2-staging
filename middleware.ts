import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // ১. ব্রাউজার থেকে সিকিউর কুকি নেওয়া হচ্ছে
  const token = req.cookies.get("zenex_token")?.value;
  const path = req.nextUrl.pathname;

  // ২. API, লগিন বা রেজিস্টার পেজে কাউকে বাধা দেওয়া হবে না
  if (path.startsWith("/login") || path.startsWith("/register") || path.startsWith("/api")) {
    return NextResponse.next();
  }

  // ৩. যদি কোনো টোকেন/কুকি না থাকে, সরাসরি লগিন পেজে লাথি খাবে
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 💥 ৪. SUPER ADMIN FIREWALL (Role Checking) 💥
  try {
    // JWT টোকেন থেকে ডাটা বের করা হচ্ছে (Edge Runtime-এ কাজ করার জন্য Base64 Decode)
    const payloadBase64 = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payloadBase64));
    const userRole = decodedPayload.role;

    // যদি কেউ /admin বা /users পেজে ঢোকার চেষ্টা করে, কিন্তু সে এডমিন না হয়...
    if (path.startsWith("/admin") || path.startsWith("/users")) {
      if (userRole !== "admin") {
        console.warn(`🚨 Security Alert: Non-admin user tried to access admin panel!`);
        return NextResponse.redirect(new URL("/", req.url)); 
      }
    }

    // যদি কোনো সাধারণ ইউজার /my-users (এজেন্ট পেজ) এ ঢোকার চেষ্টা করে...
    if (path.startsWith("/my-users")) {
      if (userRole !== "agent" && userRole !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

  } catch (error) {
    // যদি কেউ ফেক টোকেন বানানোর চেষ্টা করে, টোকেন কাজ করবে না, লগিনে পাঠিয়ে দিবে
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // সব চেক পাস করলে পেজে ঢুকতে দিবে
  return NextResponse.next();
}

// কোন কোন পেজে এই ফায়ারওয়াল কাজ করবে তা নির্ধারণ করা হলো
export const config = {
  matcher: [
    "/", 
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