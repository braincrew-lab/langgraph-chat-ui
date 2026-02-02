import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { approveUser } from "@/lib/services/user.service";
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

    const result = await approveUser(id, session.user.id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
