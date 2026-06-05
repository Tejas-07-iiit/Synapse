import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "developmentsupersecretkey123456789012345";
const MCX_BACKEND_URL = process.env.MCX_BACKEND_URL || "http://localhost:5000";

export async function GET(req: NextRequest) {
  const redirectUrl = req.nextUrl.searchParams.get("redirect") || "/mcx";
  const token = req.cookies.get("token")?.value;

  if (!token) {
    console.log("[Auto-Login] No crypto token cookie found. Redirecting to /login.");
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    const email = (payload.email as string)?.toLowerCase();
    const username = (payload.username as string) || "user";
    
    if (!email) {
      console.log("[Auto-Login] JWT payload did not contain email. Redirecting to /login.");
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const defaultPassword = `sync_auth_mcx_secret_${JWT_SECRET}`;

    console.log(`[Auto-Login] Syncing user ${email} to MCX backend...`);

    // 1. Attempt MCX Login
    let loginRes = await fetch(`${MCX_BACKEND_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: defaultPassword }),
      cache: "no-store",
    });

    let loginData = await loginRes.json();

    // 2. If user doesn't exist, create it programmatically
    if (!loginRes.ok || !loginData.success) {
      console.log(`[Auto-Login] User ${email} not found in MCX database. Auto-registering...`);
      
      const signupRes = await fetch(`${MCX_BACKEND_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: username,
          lastName: "User",
          email,
          phone: "0000000000",
          password: defaultPassword,
        }),
        cache: "no-store",
      });

      const signupData = await signupRes.json();

      if (signupRes.ok && signupData.success) {
        console.log(`[Auto-Login] Auto-registered ${email} successfully. Retrying login...`);
        // Retry Login
        loginRes = await fetch(`${MCX_BACKEND_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: defaultPassword }),
          cache: "no-store",
        });
        loginData = await loginRes.json();
      } else {
        console.error("[Auto-Login] Sign-up failed on MCX backend:", signupData.message);
      }
    }

    // 3. Extract cookie and set it on the frontend
    if (loginRes.ok && loginData.success) {
      const setCookieHeaders = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
      let tokenVal = "";
      
      for (const cookieStr of setCookieHeaders) {
        if (cookieStr.startsWith("token=")) {
          tokenVal = cookieStr.split(";")[0].substring(6);
          break;
        }
      }

      if (!tokenVal) {
        const fallbackCookie = loginRes.headers.get("set-cookie");
        if (fallbackCookie && fallbackCookie.includes("token=")) {
          const parts = fallbackCookie.split(";");
          const tokenPart = parts.find(p => p.trim().startsWith("token="));
          if (tokenPart) tokenVal = tokenPart.trim().substring(6);
        }
      }

      if (tokenVal) {
        console.log(`[Auto-Login] Successfully synced session. Redirecting to ${redirectUrl}`);
        const response = NextResponse.redirect(new URL(redirectUrl, req.url));
        response.cookies.set("mcx_token", tokenVal, {
          httpOnly: true,
          secure: false, // local development fallback
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
        return response;
      }
    }

    console.error("[Auto-Login] Failed to obtain session from MCX backend.");
    // Fail-safe redirect to manual login
    return NextResponse.redirect(new URL("/mcx/login", req.url));

  } catch (error) {
    console.error("[Auto-Login System Error]:", error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}
