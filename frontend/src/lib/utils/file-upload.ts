/**
 * File upload utilities for schema file fields.
 * Supports two modes:
 * - "base64": converts file to raw base64 string (no data URI prefix)
 * - "url": uploads file to /api/upload and returns the URL string
 */

/**
 * Process a file according to the upload mode.
 * Returns a string value suitable for storing in a schema field.
 */
export async function processFileForField(
  file: File,
  mode: "base64" | "url",
): Promise<string> {
  if (mode === "url") {
    return uploadFileToServer(file);
  }
  return fileToBase64(file);
}

/**
 * Upload a file to the server and return its URL.
 */
export async function uploadFileToServer(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Upload failed (${response.status})`);
  }

  const data = await response.json();
  return data.url as string;
}

/**
 * Convert a file to a raw base64 string (without data URI prefix).
 * e.g. "JVBERi0xLjcN..." (not "data:application/pdf;base64,JVBERi0xLjcN...")
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip the data URI prefix: "data:<mime>;base64," → raw base64
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Extract a display-friendly filename from a base64 string or URL value.
 */
export function extractDisplayName(value: string): string {
  if (!value) return "";

  // Raw base64 or data URI — no filename available
  if (
    value.startsWith("data:") ||
    (/^[A-Za-z0-9+/]/.test(value) && value.length > 200)
  ) {
    return "file";
  }

  // URL — extract filename from path
  try {
    const parts = value.split("/");
    return parts[parts.length - 1] || value;
  } catch {
    return value;
  }
}
