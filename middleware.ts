import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";

const SESSION_COOKIE = "lumen_session";
const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "lumen-dev-secret-change-in-production"
);

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/signup"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and API routes
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const response = NextResponse.next();

    // Sliding session refresh: re-issue token when older than 3.5 days
    const iat = (payload.iat as number) ?? 0;
    const ageSeconds = Math.floor(Date.now() / 1000) - iat;
    const REFRESH_AFTER = 3.5 * 24 * 60 * 60; // 3.5 days in seconds

    if (ageSeconds > REFRESH_AFTER) {
      const newToken = await new SignJWT({
        userId: payload.userId,
        email: payload.email,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(SECRET);
      response.cookies.set(SESSION_COOKIE, newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" && !process.env.ELECTRON,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return response;
  } catch {
    // Invalid/expired token — clear it and redirect
    const response = NextResponse.redirect(
      new URL("/auth/login", request.url)
    );
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
