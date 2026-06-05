import { NextRequest, NextResponse } from "next/server";

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const pathParts = resolvedParams.path || [];
    if (pathParts.length === 0) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const section = pathParts[0];
    const rest = pathParts.slice(1).join("/");
    
    let targetPath = "";
    if (section === "auth") {
      targetPath = rest ? `auth/${rest}` : "auth";
    } else if (section === "bot") {
      targetPath = rest ? `bot/${rest}` : "bot";
    } else if (section === "chart") {
      targetPath = rest ? `chart/${rest}` : "chart";
    } else if (section === "trade") {
      targetPath = rest ? `trade/${rest}` : "trade";
    } else if (section === "user-settings") {
      targetPath = rest ? `user-settings/${rest}` : "user-settings";
    } else if (section === "mcx") {
      targetPath = rest ? `mcx/${rest}` : "mcx";
    } else {
      targetPath = pathParts.join("/");
    }

    const backendUrl = process.env.MCX_BACKEND_URL || "http://localhost:5000";
    const url = `${backendUrl}/api/${targetPath}${req.nextUrl.search}`;

    // Extract headers
    const headers = new Headers();
    req.headers.forEach((val, key) => {
      if (key.toLowerCase() !== "host" && key.toLowerCase() !== "cookie") {
        headers.set(key, val);
      }
    });

    // Handle cookies
    const mcxToken = req.cookies.get("mcx_token")?.value;
    if (mcxToken) {
      headers.set("Cookie", `token=${mcxToken}`);
      headers.set("Authorization", `Bearer ${mcxToken}`);
    }

    // Get body if method allows
    let body: string | undefined = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = await req.text();
    }

    console.log(`[Proxy] Forwarding ${req.method} to ${url}`);

    const backendRes = await fetch(url, {
      method: req.method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });

    const resBody = await backendRes.text();
    
    // Create response
    const response = new NextResponse(resBody, {
      status: backendRes.status,
      headers: {
        "Content-Type": backendRes.headers.get("content-type") || "application/json",
      },
    });

    // Handle cookie from backend response
    const setCookieHeaders = backendRes.headers.getSetCookie ? backendRes.headers.getSetCookie() : [];
    if (setCookieHeaders && setCookieHeaders.length > 0) {
      for (const cookieStr of setCookieHeaders) {
        if (cookieStr.startsWith("token=")) {
          const tokenVal = cookieStr.split(";")[0].substring(6);
          
          response.cookies.set("mcx_token", tokenVal, {
            httpOnly: true,
            secure: false, // matches local development
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
        }
      }
    } else {
      // Fallback to reading the raw response headers for set-cookie
      const fallbackCookie = backendRes.headers.get("set-cookie");
      if (fallbackCookie && fallbackCookie.includes("token=")) {
        const parts = fallbackCookie.split(";");
        const tokenPart = parts.find(p => p.trim().startsWith("token="));
        if (tokenPart) {
          const tokenVal = tokenPart.trim().substring(6);
          response.cookies.set("mcx_token", tokenVal, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
          });
        }
      }
    }

    // Handle logout explicit clearing
    if (targetPath === "auth/logout" && backendRes.status === 200) {
      response.cookies.delete("mcx_token");
    }

    return response;
  } catch (error: any) {
    console.error("[Proxy Error]:", error);
    return NextResponse.json({ error: "Proxy connection error: " + error.message }, { status: 502 });
  }
}

export {
  handleProxy as GET,
  handleProxy as POST,
  handleProxy as PUT,
  handleProxy as DELETE,
  handleProxy as PATCH
};
