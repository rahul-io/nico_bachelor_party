import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, isGateTokenValid } from "@/lib/gate";

/**
 * The invite-code gate. Runs before every page and API request; without a valid
 * gate cookie, pages go to /gate and API calls get 401. Fails closed: if the
 * invite code or the signing secret is missing, nothing gets through.
 */

// What a visitor without the cookie may still fetch: the gate itself, and the
// few public files a link preview or the browser needs.
const OPEN_PATHS = new Set(["/gate", "/api/gate", "/manifest.webmanifest", "/icon.png", "/apple-icon.png", "/og.png", "/logo.png"]);
const OPEN_PREFIXES = ["/icons/", "/brand/"];

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.has(pathname) || OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const admitted = isGateTokenValid(request.cookies.get(GATE_COOKIE)?.value);

  if (pathname === "/gate" && admitted) return NextResponse.redirect(new URL("/", request.url));
  if (admitted || isOpenPath(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Invite code required", code: "gate" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/gate", request.url));
}

export const config = {
  // Next's own static files and its image optimiser serve only public build assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
