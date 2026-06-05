import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "developmentsupersecretkey123456789012345";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isCryptoAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isMcxAuthPage = pathname.startsWith("/mcx/login") || pathname.startsWith("/mcx/register");

  // Protect all internal application pages
  const isCryptoProtectedPage = 
    pathname.startsWith("/dashboard") || 
    pathname.startsWith("/trade-history") || 
    pathname.startsWith("/portfolio") || 
    pathname.startsWith("/market-intelligence") || 
    pathname.startsWith("/settings");

  const isMcxProtectedPage = 
    pathname.startsWith("/mcx") && 
    !pathname.startsWith("/mcx/login") && 
    !pathname.startsWith("/mcx/register");

  // 1. Crypto Routes Protection
  if (isCryptoProtectedPage) {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch (err) {
      console.error("Middleware Crypto JWT verification failed:", err);
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("token");
      return response;
    }
  }

  if (isCryptoAuthPage) {
    const token = request.cookies.get("token")?.value;
    if (token) {
      try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jwtVerify(token, secret);
        return NextResponse.redirect(new URL("/dashboard", request.url));
      } catch (err) {
        return NextResponse.next();
      }
    }
  }

  // 2. MCX Routes Protection
  if (isMcxProtectedPage) {
    const mcxToken = request.cookies.get("mcx_token")?.value;
    const token = request.cookies.get("token")?.value;

    if (!mcxToken) {
      if (token) {
        // Silent SSO redirection to auto-login sync route
        return NextResponse.redirect(
          new URL(`/api/mcx-autologin?redirect=${encodeURIComponent(pathname)}`, request.url)
        );
      }
      // Redirect to main login page if not logged in at all
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      await jwtVerify(mcxToken, secret);
      return NextResponse.next();
    } catch (err) {
      console.error("Middleware MCX JWT verification failed:", err);
      // Try to re-authenticate with Crypto token if valid
      if (token) {
        return NextResponse.redirect(
          new URL(`/api/mcx-autologin?redirect=${encodeURIComponent(pathname)}`, request.url)
        );
      }
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.delete("mcx_token");
      return response;
    }
  }

  if (isMcxAuthPage) {
    const mcxToken = request.cookies.get("mcx_token")?.value;
    const token = request.cookies.get("token")?.value;

    if (mcxToken) {
      try {
        const secret = new TextEncoder().encode(JWT_SECRET);
        await jwtVerify(mcxToken, secret);
        return NextResponse.redirect(new URL("/mcx", request.url));
      } catch (err) {
        // Fall through
      }
    }

    // If visiting mcx/login but already logged into crypto, auto-login
    if (token) {
      return NextResponse.redirect(
        new URL(`/api/mcx-autologin?redirect=/mcx`, request.url)
      );
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


