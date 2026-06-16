import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "developmentsupersecretkey123456789012345";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isCryptoAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isMcxAuthPage = pathname.startsWith("/mcx/login") || pathname.startsWith("/mcx/register");

  // Protected internal application pages (Crypto and MCX)
  const isProtectedPage = 
    pathname.startsWith("/dashboard") || 
    pathname.startsWith("/trade-history") || 
    pathname.startsWith("/portfolio") || 
    pathname.startsWith("/market-intelligence") || 
    pathname.startsWith("/settings") ||
    (pathname.startsWith("/mcx") && !pathname.startsWith("/mcx/login") && !pathname.startsWith("/mcx/register"));

  if (isProtectedPage) {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (err) {
      console.error("Middleware JWT verification failed:", err);
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  if (isCryptoAuthPage || isMcxAuthPage) {
    const token = request.cookies.get("token")?.value;
    if (token) {
      try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jwtVerify(token, secret);
        return NextResponse.redirect(new URL(pathname.startsWith("/mcx") ? "/mcx" : "/dashboard", request.url));
      } catch (err) {
        return NextResponse.next();
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/trade-history/:path*",
    "/portfolio/:path*",
    "/market-intelligence/:path*",
    "/settings/:path*",
    "/login",
    "/register",
    "/mcx/:path*",
  ],
};


