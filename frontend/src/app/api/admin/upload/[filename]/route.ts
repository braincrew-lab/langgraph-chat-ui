import { NextRequest, NextResponse } from "next/server";
import { readFile, access, constants } from "fs/promises";
import path from "path";

// Get upload directory (same as upload route)
function getUploadDir(): string {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  return path.join(process.cwd(), "public", "uploads");
}

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    const { filename } = await params;

    // Security: prevent directory traversal
    if (
      filename.includes("..") ||
      filename.includes("/") ||
      filename.includes("\\")
    ) {
      return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    const uploadDir = getUploadDir();
    const filepath = path.join(uploadDir, filename);

    // Check if file exists
    try {
      await access(filepath, constants.R_OK);
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filepath);

    // Determine MIME type
    const ext = path.extname(filename).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    // Build response headers
    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };

    // SVG files can contain scripts - force download to prevent XSS
    if (mimeType === "image/svg+xml") {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error("File serve error:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 },
    );
  }
}
