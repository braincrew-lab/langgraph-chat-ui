import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";
import { writeFile, mkdir, access, constants } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

// Try multiple upload directories (for both dev and production)
function getUploadDir(): string {
  // Priority: UPLOAD_DIR env var > public/uploads
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  return path.join(process.cwd(), "public", "uploads");
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await access(dir, constants.W_OK);
  } catch {
    await mkdir(dir, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, GIF, WEBP, SVG, ICO" },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 2MB" },
        { status: 400 },
      );
    }

    const uploadDir = getUploadDir();

    // Ensure upload directory exists and is writable
    try {
      await ensureDir(uploadDir);
    } catch (dirError) {
      console.error("Failed to create upload directory:", dirError);
      return NextResponse.json(
        {
          error:
            "Upload directory is not writable. Please check server configuration.",
        },
        { status: 500 },
      );
    }

    // Generate unique filename
    const ext = path.extname(file.name) || getExtensionFromMimeType(file.type);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Return the URL (use API route for serving in production)
    const url = `/api/admin/upload/${filename}`;

    return NextResponse.json({ url, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}

function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
  };
  return map[mimeType] || ".png";
}
