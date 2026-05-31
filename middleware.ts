import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("zenex_token")?.value;
  const path = req.nextUrl.pathname;

  // 1. API পেজে কাউকে বাধা দেওয়া হবে না (Backend Security Handle করবে)
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  // 2. 💥 ম্যাজিক: লগিন করা অবস্থায় /login বা /register এ গেলে সোজা ড্যাশবোর্ডে পাঠাবে! 💥
  if (path === "/login" || path === "/register") {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 3. যদি কোনো টোকেন/কুকি না থাকে, সরাসরি লগিন পেজে লাথি খাবে
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 4. 💥 SUPER ADMIN FIREWALL (Role Checking & Zero DB Load) 💥
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