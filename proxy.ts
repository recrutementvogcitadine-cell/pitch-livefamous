import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const legacyPrefixes = [
  "/ancienne-route",
  "/dashboard",
  "/login",
  "/window",
  "/supabase-test",
  "/akoua-video",
  "/settings",
];

function isLegacyPath(pathname: string) {
  return legacyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLegacyPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/ancienne-route/:path*",
    "/dashboard/:path*",
    "/dashboard",
    "/login/:path*",
    "/login",
    "/window/:path*",
    "/window",
    "/supabase-test/:path*",
    "/supabase-test",
    "/akoua-video/:path*",
    "/akoua-video",
    "/settings/:path*",
    "/settings",
  ],
};
