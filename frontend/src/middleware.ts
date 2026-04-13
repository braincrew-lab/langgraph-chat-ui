import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isPublicMode,
  isCustomJwtMode,
  isApiKeyMode,
  getRouteType,
  canAccessApp,
  canAccessAdmin,
} from "@/lib/auth/mode";
import type { UserRole, UserStatus } from "@/types/auth-mode";
import {
  LOCALE_COOKIE_NAME,
  defaultLocale,
  locales,
  type Locale,
} from "@/i18n/config";
import { COOKIES } from "@/lib/constants";

/**
 * Check if request has a Bearer token in the Authorization header.
 */
function hasBearerToken(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ?? false;
}

/**
 * Set locale cookie on response if not already present in request.
 */
function withLocaleCookie(
  req: NextRequest,
  response: NextResponse,
): NextResponse {
  if (!req.cookies.get(LOCALE_COOKIE_NAME)?.value) {
    const acceptLang = req.headers.get("accept-language") ?? "";
    const detected = acceptLang
      .split(",")
      .map((part) => part.split(";")[0].trim().substring(0, 2).toLowerCase())
      .find((lang) => locales.includes(lang as Locale)) as Locale | undefined;
    response.cookies.set(LOCALE_COOKIE_NAME, detected ?? defaultLocale, {
      path: "/",
      maxAge: COOKIES.MAX_AGE,
      sameSite: "lax",
    });
  }
  return response;
}

/**
 * Simple middleware for standalone/oauth-direct modes (no NextAuth)
 */
export default async function middleware(req: NextRequest) {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const routeType = getRouteType(pathname);

  // STANDALONE / OAUTH-DIRECT MODE: No login UI, no NextAuth
  if (isPublicMode()) {
    // Admin routes and auth pages are blocked in these modes
    if (
      routeType === "admin" ||
      pathname === "/login" ||
      pathname === "/register"
    ) {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
    return withLocaleCookie(req, NextResponse.next());
  }

  // CUSTOM-JWT / API-KEY MODE: Login UI required but no NextAuth session
  if (isCustomJwtMode() || isApiKeyMode()) {
    // Public routes (login, callback) are always accessible
    if (routeType === "public") {
      return withLocaleCookie(req, NextResponse.next());
    }

    // Admin routes: not available in non-NextAuth modes
    if (routeType === "admin") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }

    // API routes with Bearer token or x-api-key: let through
    if (routeType === "api" && (hasBearerToken(req) || req.headers.get("x-api-key"))) {
      return NextResponse.next();
    }

    // For custom-jwt: check if IdP token cookie exists
    if (isCustomJwtMode()) {
      const hasIdpToken = req.cookies.get("lg_idp_token")?.value;
      if (!hasIdpToken) {
        if (routeType === "api") {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    // For api-key: check if API key exists in cookie or env
    if (isApiKeyMode()) {
      const hasApiKey =
        req.cookies.get("lg_apiKey")?.value ||
        process.env.LANGCHAIN_API_KEY ||
        process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY;
      if (!hasApiKey) {
        if (routeType === "api") {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = new URL("/login", nextUrl);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    return withLocaleCookie(req, NextResponse.next());
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
    return withLocaleCookie(req, NextResponse.next());
  }

  // For API routes with Bearer token, let them through at the middleware level.
  // Actual token validation is performed by individual route handlers
  // (e.g., langsmith/runs, admin endpoints) - this is just a gate to avoid
  // redirecting programmatic API clients to the login page.
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
    return withLocaleCookie(req, NextResponse.next());
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

  return withLocaleCookie(req, NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
