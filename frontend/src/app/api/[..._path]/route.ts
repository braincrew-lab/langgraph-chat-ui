import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";
import { getAllSettings } from "@/lib/services/settings.service";
import { resolveApiUrl } from "@/lib/connections/resolve";
import { requiresNextAuth } from "@/types/auth-mode";
import { generateUserJWT } from "@/lib/auth/jwt";
import { isPrivateUrl } from "@/lib/utils/url-validation";

function getCorsHeaders(req: NextRequest) {
  const origin = req.headers.get("origin");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  // Determine allowed origin: configured app URL, or same-origin only
  let allowedOrigin = "";
  if (appUrl && origin === appUrl) {
    allowedOrigin = appUrl;
  } else if (origin) {
    // Allow same-origin requests (origin matches the request host)
    const requestHost = req.headers.get("host");
    try {
      const originHost = new URL(origin).host;
      if (requestHost && originHost === requestHost) {
        allowedOrigin = origin;
      }
    } catch {
      // Invalid origin - don't set allow header
    }
  }

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function handleRequest(req: NextRequest, method: string) {
  const needsAuth = requiresNextAuth();

  // Get user session (only for auth modes that require it)
  type SessionType = {
    user?: {
      id: string;
      email?: string | null;
      name?: string | null;
      role?: string;
      status?: string;
    };
  } | null;
  let session: SessionType = null;
  if (needsAuth) {
    const { auth } = await import("@/lib/auth");
    session = (await auth()) as SessionType;
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Get API URL - Priority: Cookies > DB admin settings > Server env > Public env
    const cookieStore = await cookies();
    const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
    const globalSettings = await getAllSettings();
    const adminDefaultApiUrl =
      globalSettings["features.defaultConnectionApiUrl"];

    const apiUrl = resolveApiUrl(cookieApiUrl, adminDefaultApiUrl);

    if (!apiUrl) {
      return NextResponse.json(
        { error: "LangGraph API URL is not configured" },
        { status: 500 },
      );
    }

    // SSRF prevention: validate user-provided URLs (from cookies)
    // Server env vars (LANGGRAPH_API_URL) are trusted and skip validation
    if (cookieApiUrl && cookieApiUrl === apiUrl && isPrivateUrl(apiUrl)) {
      return NextResponse.json(
        { error: "Invalid API URL: private network addresses are not allowed" },
        { status: 400 },
      );
    }

    // Extract path from the catch-all route
    const path = req.nextUrl.pathname.replace(/^\/?api\//, "");

    // Build query string
    const url = new URL(req.url);
    const searchParams = new URLSearchParams(url.search);
    searchParams.delete("_path");
    searchParams.delete("nxtP_path");
    const queryString = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "";

    // Build headers - preserve original Content-Type or default to application/json
    const contentType = req.headers.get("content-type") || "application/json";
    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };

    // Generate signed JWT token for LangGraph server using shared utility
    const token = await generateUserJWT();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Build request options
    const options: RequestInit = {
      method,
      headers,
    };

    // Forward body for methods that support it
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const buffer = await req.arrayBuffer();
      options.body = Buffer.from(buffer);
    }

    // Make request to LangGraph server
    const targetUrl = `${apiUrl}/${path}${queryString}`;

    const res = await fetch(targetUrl, options);

    // Return response with CORS headers
    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        ...getCorsHeaders(req),
      },
    });
  } catch (e) {
    const error = e as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const runtime = "nodejs"; // Need nodejs for auth()

export async function GET(req: NextRequest) {
  return handleRequest(req, "GET");
}

export async function POST(req: NextRequest) {
  return handleRequest(req, "POST");
}

export async function PUT(req: NextRequest) {
  return handleRequest(req, "PUT");
}

export async function PATCH(req: NextRequest) {
  return handleRequest(req, "PATCH");
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req, "DELETE");
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}
