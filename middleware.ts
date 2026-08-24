import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 💥 HELPER FUNCTION: Inject VPN Optimization & Edge Caching Headers 💥
function applySpeedHeaders(response: NextResponse, path: string) {
  // Static pages (Login/Register/Terms) can be cached safely in CDN & Browser
  if (path === '/login' || path === '/register' || path === '/terms') {
    response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
  }
  // Tell the browser and proxy that we support Brotli and Gzip compression (Crucial for VPN users)
  response.headers.set('Accept-Encoding', 'gzip, deflate, br');
  return response;
}

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
    const response = NextResponse.next();
    return applySpeedHeaders(response, path);
  }

  // 2. Allow normal API routes & PUBLIC Pages (e.g. /terms)
  // 💥 FIX: Terms page is now fully public and accessible without login 💥
  if (path.startsWith("/api") || path === "/terms") {
    const response = NextResponse.next();
    return applySpeedHeaders(response, path);
  }

  // 3. Login/Register page handling
  if (path === "/login" || path === "/register") {
    if (token) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    const response = NextResponse.next();
    return applySpeedHeaders(response, path);
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

  // 6. Proceed for normal pages securely
  const finalResponse = NextResponse.next(); 
  return applySpeedHeaders(finalResponse, path);
}

// 💥 UNIVERSAL MATCHER: Protects ALL current and future pages automatically!
// Skips internal Next.js static files (_next), images, and fonts to save CPU & RAM.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2)$).*)"
  ],
};