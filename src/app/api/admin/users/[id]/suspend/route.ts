import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { suspendUser } from "@/lib/services/user.service";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    const { id } = await params;

    if (!session?.user || !isAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body.reason;

    const result = await suspendUser(id, session.user.id, reason);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error suspending user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
