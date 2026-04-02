import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("zenex_token")?.value;
  const path = req.nextUrl.pathname;

  // 💥 ম্যাজিক: যদি ইউজার লগিন করা অবস্থায় নতুন ট্যাবে /login বা /register এ যায়, 
  // তাহলে তাকে লগিন পেজ না দেখিয়ে সোজা ড্যাশবোর্ডে পাঠাবে! 💥
  if (path === "/login" || path === "/register") {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // API পেজে কাউকে বাধা দেওয়া হবে না
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  // যদি কোনো টোকেন/কুকি না থাকে, সরাসরি লগিন পেজে লাথি খাবে
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 💥 SUPER ADMIN FIREWALL (Role Checking) 💥
  try {
    const payloadBase64 = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payloadBase64));
    const userRole = decodedPayload.role;

    if (path.startsWith("/admin") || path.startsWith("/users")) {
      if (userRole !== "admin") {
        console.warn(`🚨 Security Alert: Non-admin user tried to access admin panel!`);
        return NextResponse.redirect(new URL("/", req.url)); 
      }
    }

    if (path.startsWith("/my-users")) {
      if (userRole !== "agent" && userRole !== "admin") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

  } catch (error) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

// 💥 ম্যাজিক: matcher এ /login এবং /register অ্যাড করা হয়েছে, 
// যাতে নতুন ট্যাবে ওপেন করলে মিডলওয়্যার কাজ করতে পারে! 💥
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