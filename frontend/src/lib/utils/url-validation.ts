/**
 * URL validation utilities for SSRF prevention
 *
 * Validates API URLs to prevent Server-Side Request Forgery (SSRF) attacks.
 * Blocks requests to private/internal networks when URL comes from user input (cookies).
 */

/**
 * Check if a hostname resolves to a private/internal IP range.
 * Blocks: RFC 1918, loopback, link-local, and other internal ranges.
 */
export function isPrivateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    // Block localhost variations
    if (
      hostname === "localhost" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0"
    ) {
      return true;
    }

    // Check IP-based hostnames
    const ipv4Match = hostname.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
    );
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);

      // 127.x.x.x - Loopback
      if (a === 127) return true;

      // 10.x.x.x - RFC 1918
      if (a === 10) return true;

      // 172.16.0.0 - 172.31.255.255 - RFC 1918
      if (a === 172 && b >= 16 && b <= 31) return true;

      // 192.168.x.x - RFC 1918
      if (a === 192 && b === 168) return true;

      // 169.254.x.x - Link-local
      if (a === 169 && b === 254) return true;

      // 0.0.0.0/8
      if (a === 0) return true;
    }

    return false;
  } catch {
    // Invalid URL - treat as unsafe
    return true;
  }
}

/**
 * Validate an API URL from user input (cookie).
 * Returns true if the URL is safe to proxy requests to.
 */
export function validateApiUrl(url: string): boolean {
  if (!url || url.trim() === "") return false;

  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    // Block private/internal URLs
    if (isPrivateUrl(url)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
