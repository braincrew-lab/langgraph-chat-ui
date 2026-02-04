import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getAllSettings,
  updateSettings,
  getSettingsWithMeta,
} from "@/lib/services/settings.service";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";
import type { GlobalSettings } from "@/types/global-settings";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const withMeta = searchParams.get("meta") === "true";

    if (withMeta) {
      const settings = await getSettingsWithMeta();
      return NextResponse.json(settings);
    }

    const settings = await getAllSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || !isAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Partial<GlobalSettings>;

    await updateSettings(body, session.user.id);

    const settings = await getAllSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
