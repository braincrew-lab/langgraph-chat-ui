/**
 * API Key Validation Endpoint
 *
 * Validates an API key by calling the LangGraph server's
 * /assistants/search endpoint which requires authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/auth/api-key";
import { resolveApiUrl } from "@/lib/connections/resolve";
import { cookies } from "next/headers";
import { CONNECTION_COOKIE_NAMES } from "@/lib/connections/cookies";
import { getAllSettings } from "@/lib/services/settings.service";
import { isPrivateUrl } from "@/lib/utils/url-validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = body.apiKey;

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { valid: false, error: "API key is required" },
        { status: 400 },
      );
    }

    // Resolve the API URL
    const cookieStore = await cookies();
    const cookieApiUrl = cookieStore.get(CONNECTION_COOKIE_NAMES.apiUrl)?.value;
    const globalSettings = await getAllSettings();
    const adminDefaultApiUrl =
      globalSettings["features.defaultConnectionApiUrl"];
    const apiUrl = resolveApiUrl(cookieApiUrl, adminDefaultApiUrl);

    if (!apiUrl) {
      return NextResponse.json(
        { valid: false, error: "LangGraph API URL is not configured" },
        { status: 500 },
      );
    }

    // SSRF prevention: reject private network URLs from cookies
    if (cookieApiUrl && cookieApiUrl === apiUrl && isPrivateUrl(apiUrl)) {
      return NextResponse.json(
        { valid: false, error: "Invalid API URL: private network addresses are not allowed" },
        { status: 400 },
      );
    }

    const result = await validateApiKey(apiUrl, apiKey);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Validation failed" },
      { status: 500 },
    );
  }
}
