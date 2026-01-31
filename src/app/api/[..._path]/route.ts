import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { SignJWT } from "jose";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connection-cookies";
import { getAllSettings } from "@/lib/services/settings.service";

// Fallback: LANGGRAPH_API_URL (preferred) or NEXT_PUBLIC_API_URL
const ENV_LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || process.env.NEXT_PUBLIC_API_URL;

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

async function handleRequest(req: NextRequest, method: string) {
  // Get user session
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get API URL from: Admin settings > Cookies > Environment variable
    const cookieStore = await cookies();
    const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
    const globalSettings = await getAllSettings();
    const adminDefaultApiUrl = globalSettings["features.defaultConnectionApiUrl"];

    // Priority: Admin default (if set) > Cookies > Environment variable
    const apiUrl = adminDefaultApiUrl
      ? adminDefaultApiUrl
      : (cookieApiUrl || ENV_LANGGRAPH_API_URL);

    if (!apiUrl) {
      return NextResponse.json(
        { error: "LangGraph API URL is not configured" },
        { status: 500 }
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

    // Generate signed JWT token for LangGraph server
    const token = await new SignJWT({
      sub: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      status: session.user.status,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET!));

    console.log("[LangGraph Proxy] User:", session.user.email);
    console.log("[LangGraph Proxy] API URL:", apiUrl);

    // Build headers with Bearer token
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    };

    // Build request options
    const options: RequestInit = {
      method,
      headers,
    };

    // Add body for methods that support it
    if (["POST", "PUT", "PATCH"].includes(method)) {
      options.body = await req.text();
    }

    // Make request to LangGraph server
    const targetUrl = `${apiUrl}/${path}${queryString}`;
    console.log("[LangGraph Proxy] Target URL:", targetUrl);

    const res = await fetch(targetUrl, options);
    console.log("[LangGraph Proxy] Response status:", res.status);

    // Return response with CORS headers
    return new NextResponse(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: {
        ...Object.fromEntries(res.headers.entries()),
        ...getCorsHeaders(),
      },
    });
  } catch (e) {
    const error = e as Error;
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}
