import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createApiToken,
  getUserTokens,
  deleteApiToken,
} from "@/lib/services/api-token.service";
import { z } from "zod";

const createTokenSchema = z.object({
  name: z.string().min(1).max(100),
  expiresInDays: z.number().int().min(0).max(365).optional(),
});

/**
 * GET /api/auth/tokens
 * List all tokens for the current user
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await getUserTokens(session.user.id);

  return NextResponse.json({ tokens });
}

/**
 * POST /api/auth/tokens
 * Create a new API token
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is active
  if (session.user.status !== "active") {
    return NextResponse.json({ error: "Account is not active" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = createTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, expiresInDays } = parsed.data;
    const result = await createApiToken(session.user.id, name, expiresInDays);

    return NextResponse.json({
      token: result.token,
      info: result.info,
      message: "Token created successfully. Save this token - it won't be shown again!",
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to create token" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/tokens
 * Delete a token by ID (passed in request body)
 */
export async function DELETE(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const tokenId = body.tokenId;

    if (!tokenId || typeof tokenId !== "string") {
      return NextResponse.json(
        { error: "Token ID is required" },
        { status: 400 }
      );
    }

    const result = await deleteApiToken(tokenId, session.user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Unauthorized" ? 403 : 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete token" },
      { status: 500 }
    );
  }
}
