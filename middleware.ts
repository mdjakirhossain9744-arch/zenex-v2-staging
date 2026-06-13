import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("zenex_token")?.value;
  const path = req.nextUrl.pathname;

  // 🛡️ 1. ENTERPRISE API FIREWALL (Anti-DDoS & Bot Security) 🛡️
  if (path.startsWith("/api/v1/")) {
    const apiKey = req.headers.get("mapikey");
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0] || "Unknown IP";
    
    if (!apiKey || apiKey.trim().length < 10) {
      console.warn(`🚨 Firewall Blocked Unauthorized Bot IP: ${clientIp}`);
      return NextResponse.json(
        { meta: { status: "error" }, message: "Access Denied: Missing or Invalid API Key. Server Protected by ZENEX Firewall." }, 
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // 2. Allow normal API routes
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  // 3. Login/Register page handling
  if (path === "/login" || path === "/register") {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // 4. Protect all other pages: Kick to login if no token
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 5. 💥 SUPER ADMIN FIREWALL (Optimized for ZERO LAG) 💥
  // Only decode JWT if the user is trying to access protected paths!
  if (path.startsWith("/admin") || path.startsWith("/users") || path.startsWith("/my-users")) {
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      const userRole = decodedPayload.role; 

      if ((path.startsWith("/admin") || path.startsWith("/users")) && userRole !== "admin") {
        return NextResponse.redirect(new URL("/", req.url)); 
      }

      if (path.startsWith("/my-users") && (userRole !== "agent" && userRole !== "admin")) {
        return NextResponse.redirect(new URL("/", req.url));
      }

    } catch (error) {
      const response = NextResponse.redirect(new URL("/login", req.url));
      response.cookies.delete("zenex_token");
      return response;
    }
  }

  return NextResponse.next(); // Instantly proceed for normal pages
}

export const config = {
  matcher: [
    "/api/:path*", "/", "/login", "/register",
    "/admin/:path*", "/users/:path*", "/console/:path*", 
    "/summary/:path*", "/get-number/:path*", "/payment/:path*", 
    "/profile/:path*", "/my-users/:path*"
  ],
};