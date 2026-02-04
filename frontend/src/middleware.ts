import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicMode,
  getRouteType,
  canAccessApp,
  canAccessAdmin,
} from "@/lib/auth/mode";
import type { UserRole, UserStatus } from "@/types/auth-mode";

/**
 * Check if request has a Bearer token in the Authorization header.
 */
function hasBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ?? false;
}

/**
 * Simple middleware for standalone/oauth-direct modes (no NextAuth)
 */
export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const routeType = getRouteType(pathname);

  // STANDALONE / OAUTH-DIRECT MODE: No NextAuth required
  if (isPublicMode()) {
    // Admin routes are blocked in these modes
    if (routeType === "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // CREDENTIALS / OAUTH / EMAIL MODE: Use NextAuth
  // Get session using auth()
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const isLoggedIn = !!session?.user;

  const user = session?.user as { role?: string; status?: string } | undefined;
  const userRole = (user?.role || "user") as UserRole;
  const userStatus = (user?.status || "active") as UserStatus;

  // Public routes are always accessible
  if (routeType === "public") {
    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
      const appAccess = canAccessApp({ status: userStatus, role: userRole });
      if (!appAccess.allowed && appAccess.redirectTo) {
        return NextResponse.redirect(new URL(appAccess.redirectTo, nextUrl));
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // For API routes with Bearer token, let them through
  if (routeType === "api" && hasBearerToken(req)) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (routeType === "api") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin routes require admin role
  if (routeType === "admin") {
    const adminAccess = canAccessAdmin({ role: userRole, status: userStatus });
    if (!adminAccess.allowed) {
      return NextResponse.redirect(
        new URL(adminAccess.redirectTo || "/", nextUrl),
      );
    }
    return NextResponse.next();
  }

  // Protected routes - check if user can access app
  const appAccess = canAccessApp({ status: userStatus, role: userRole });
  if (!appAccess.allowed) {
    if (routeType === "api") {
      return NextResponse.json(
        { error: appAccess.reason || "Forbidden" },
        { status: 403 },
      );
    }
    return NextResponse.redirect(
      new URL(appAccess.redirectTo || "/login", nextUrl),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
