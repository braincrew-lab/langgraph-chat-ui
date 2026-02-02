import { auth } from "@/lib/auth";
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
 * Bearer tokens are validated in API route handlers, not in middleware,
 * because Prisma doesn't work in Edge Runtime.
 */
function hasBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ?? false;
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  const routeType = getRouteType(pathname);

  // Get user info from session
  const user = req.auth?.user as { role?: string; status?: string } | undefined;
  const userRole = (user?.role || "user") as UserRole;
  const userStatus = (user?.status || "active") as UserStatus;

  // PUBLIC MODE: Almost everything is accessible without auth
  if (isPublicMode()) {
    // Admin routes are blocked in public mode
    if (routeType === "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    // Everything else is accessible
    return NextResponse.next();
  }

  // AUTHENTICATED MODE: Require login for most routes

  // Public routes are always accessible
  if (routeType === "public") {
    // If logged in and trying to access login/register, redirect appropriately
    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
      // Check if user can access the app
      const appAccess = canAccessApp({ status: userStatus, role: userRole });
      if (!appAccess.allowed && appAccess.redirectTo) {
        return NextResponse.redirect(new URL(appAccess.redirectTo, nextUrl));
      }
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return NextResponse.next();
  }

  // From here on, user must be logged in (or have a Bearer token for API routes)

  // For API routes with Bearer token, let them through to the route handler
  // The route handler will validate the token using the api-auth helper
  if (routeType === "api" && hasBearerToken(req)) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    // API routes return 401
    if (routeType === "api") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Page routes redirect to login
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User is logged in - check permissions

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
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
