import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUsers, getUserStats } from "@/lib/services/user.service";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole, UserStatus } from "@/types/auth-mode";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");
    const status = (searchParams.get("status") || "all") as UserStatus | "all";
    const role = (searchParams.get("role") || "all") as UserRole | "all";
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") || "createdAt") as
      | "createdAt"
      | "email"
      | "name"
      | "status";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as
      | "asc"
      | "desc";

    // If requesting stats only
    if (searchParams.get("stats") === "true") {
      const stats = await getUserStats();
      return NextResponse.json({ stats });
    }

    const result = await getUsers({
      page,
      pageSize,
      status,
      role,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
