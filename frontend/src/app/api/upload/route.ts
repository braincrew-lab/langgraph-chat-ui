import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { usesNextAuth } from "@/types/auth-mode";
import { getSetting } from "@/lib/services/settings.service";
import { internalErrorResponse } from "@/lib/api/error-response";
import { writeFile, mkdir, access, constants } from "fs/promises";
import path from "path";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_FILE_SIZE =
  (parseInt(process.env.MAX_UPLOAD_SIZE_MB || "10", 10) || 10) * 1024 * 1024;

function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return path.join(process.env.UPLOAD_DIR, "user");
  }
  return path.join(process.cwd(), "public", "uploads", "user");
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
    // Only check NextAuth session for NextAuth modes
    // custom-jwt and api-key: auth handled at proxy/middleware level
    // standalone and oauth-direct: no auth required
    if (usesNextAuth()) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Check if file upload is enabled in global settings
    const fileUploadEnabled = await getSetting("features.enableFileUpload");
    if (fileUploadEnabled === false) {
      return NextResponse.json(
        { error: "File upload is disabled" },
        { status: 403 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 },
      );
    }

    const uploadDir = getUploadDir();

    try {
      await ensureDir(uploadDir);
    } catch (dirError) {
      console.error("Failed to create upload directory:", dirError);
      return NextResponse.json(
        { error: "Upload directory is not writable." },
        { status: 500 },
      );
    }

    const ext = getExtensionFromMimeType(file.type);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${randomStr}${ext}`;
    const filepath = path.join(uploadDir, filename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    const url = `/api/upload/${filename}`;

    return NextResponse.json({ url, filename });
  } catch (error) {
    return internalErrorResponse(error, "user file upload failed");
  }
}

function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/json": ".json",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
  };
  return map[mimeType] || ".bin";
}
