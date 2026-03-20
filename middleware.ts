import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Auto-assign a permanent session UUID if none exists.
  // DB user/candidate rows are created lazily on first API call.
  if (!request.cookies.get("raj-session")) {
    const userId = crypto.randomUUID();
    response.cookies.set("raj-session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  return response;
}

export const config = {
  // Skip static assets, images, and cron routes
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/cron).*)"],
};
