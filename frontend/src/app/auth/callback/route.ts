/**
 * Custom JWT OAuth Callback Route
 *
 * Handles two flows:
 * 1. GET ?action=authorize — generates PKCE and returns authorization URL
 * 2. GET ?code=... — exchanges authorization code for tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import {
  getCustomJwtConfig,
  generatePkce,
  storePkceVerifier,
  consumePkceVerifier,
  storeIdpTokens,
} from "@/lib/auth/custom-jwt";
import { cookies } from "next/headers";

const OAUTH_STATE_COOKIE = "lg_oauth_state";

export async function GET(req: NextRequest) {
  const config = getCustomJwtConfig();

  if (!config) {
    return NextResponse.json(
      { error: "Custom JWT not configured. Set JWT_ISSUER and JWT_CLIENT_ID." },
      { status: 500 },
    );
  }

  const action = req.nextUrl.searchParams.get("action");

  // Step 1: Generate authorization URL with PKCE + state
  if (action === "authorize") {
    const { codeVerifier, codeChallenge } = generatePkce();
    await storePkceVerifier(codeVerifier);

    // Generate CSRF state parameter
    const state = randomBytes(32).toString("base64url");
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";
    cookieStore.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: `${appUrl}/auth/callback`,
      scope: "openid email profile",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      state,
    });

    const authorizationUrl = `${config.loginUrl}?${params.toString()}`;

    return NextResponse.json({ authorizationUrl });
  }

  // Step 2: Exchange authorization code for tokens
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    const errorDesc = req.nextUrl.searchParams.get("error_description") || error;
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDesc)}`, req.url),
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify CSRF state parameter
  const returnedState = req.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const savedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!returnedState || returnedState !== savedState) {
    return NextResponse.redirect(
      new URL("/login?error=Invalid+state.+Please+try+again.", req.url),
    );
  }

  // Require PKCE verifier — abort if cookie expired
  const codeVerifier = await consumePkceVerifier();
  if (!codeVerifier) {
    return NextResponse.redirect(
      new URL("/login?error=Session+expired.+Please+try+again.", req.url),
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${appUrl}/auth/callback`,
    client_id: config.clientId,
    code_verifier: codeVerifier,
  });

  if (config.clientSecret) {
    tokenParams.set("client_secret", config.clientSecret);
  }

  try {
    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error("[Custom JWT] Token exchange failed:", errorBody);
      return NextResponse.redirect(
        new URL("/login?error=Token+exchange+failed", req.url),
      );
    }

    const tokenData = await tokenResponse.json();

    await storeIdpTokens(
      tokenData.access_token,
      tokenData.refresh_token,
      tokenData.expires_in,
    );

    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    console.error("[Custom JWT] Callback error:", err);
    return NextResponse.redirect(
      new URL("/login?error=Authentication+failed", req.url),
    );
  }
}
