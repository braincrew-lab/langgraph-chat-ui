/**
 * Next.js instrumentation hook — runs once on server startup.
 * Validates required environment variables based on the configured auth mode.
 */
export async function register() {
  // Only run on the Node.js server runtime
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const authMode = (
    process.env.NEXT_PUBLIC_AUTH_MODE ||
    process.env.AUTH_MODE ||
    "standalone"
  ).toLowerCase();

  const errors: string[] = [];

  // Always required
  if (!process.env.NEXT_PUBLIC_API_URL) {
    errors.push(
      "NEXT_PUBLIC_API_URL is required (LangGraph server URL, e.g. http://localhost:2024)",
    );
  }

  // Required for auth modes that use NextAuth + database
  const requiresDB = ["credentials", "oauth", "email"].includes(authMode);

  if (requiresDB) {
    if (!process.env.DATABASE_URL) {
      errors.push(
        `DATABASE_URL is required for AUTH_MODE=${authMode} (e.g. file:./prisma/dev.db or postgresql://...)`,
      );
    }
    if (!process.env.NEXTAUTH_SECRET) {
      errors.push(
        `NEXTAUTH_SECRET is required for AUTH_MODE=${authMode} — generate with: openssl rand -base64 32`,
      );
    }
  }

  // OAuth-specific checks
  if (authMode === "oauth") {
    const hasGoogle =
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
    const hasGithub =
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET;
    if (!hasGoogle && !hasGithub) {
      errors.push(
        "AUTH_MODE=oauth requires at least one OAuth provider (set GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET)",
      );
    }
  }

  if (errors.length > 0) {
    console.error("\n╔══════════════════════════════════════════════════════╗");
    console.error("║          ENVIRONMENT CONFIGURATION ERROR             ║");
    console.error("╚══════════════════════════════════════════════════════╝\n");
    for (const error of errors) {
      console.error(`  ✗ ${error}`);
    }
    console.error(
      "\nSee .env.example for all available configuration options.\n",
    );
    process.exit(1);
  }
}
