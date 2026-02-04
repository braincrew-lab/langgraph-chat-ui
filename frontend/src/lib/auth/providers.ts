import { getAuthMode } from "@/types/auth-mode";
import { prisma } from "./prisma";
import type { UserRole, UserStatus } from "@/types/auth-mode";
import type { Provider } from "next-auth/providers";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

/**
 * Build credentials provider for email/password authentication
 */
function buildCredentialsProvider(): Provider {
  return CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const email = (credentials.email as string).toLowerCase();
      const password = credentials.password as string;

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.password) {
        return null;
      }

      // Dynamic import to avoid Edge Runtime issues
      const { compare } = await import("bcryptjs");
      const isPasswordValid = await compare(password, user.password);

      if (!isPasswordValid) {
        return null;
      }

      // Block pending users from logging in
      if (user.status === "pending") {
        return null;
      }

      // Block suspended users from logging in
      if (user.status === "suspended") {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role as UserRole,
        status: user.status as UserStatus,
      };
    },
  });
}

/**
 * Build OAuth providers based on available environment variables
 */
function buildOAuthProviders(): Provider[] {
  const providers: Provider[] = [];

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }),
    );
  }

  // GitHub OAuth
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHub({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      }),
    );
  }

  if (providers.length === 0) {
    console.warn(
      "AUTH_MODE is 'oauth' but no OAuth providers are configured. " +
        "Please set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET or GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET.",
    );
  }

  return providers;
}

/**
 * Build email magic link provider
 * Note: Requires email server configuration
 */
function buildEmailProvider(): Provider {
  // Dynamic import to avoid issues if nodemailer is not installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const EmailProvider = require("next-auth/providers/email").default;

  const missingVars: string[] = [];
  if (!process.env.EMAIL_SERVER_HOST) missingVars.push("EMAIL_SERVER_HOST");
  if (!process.env.EMAIL_SERVER_PORT) missingVars.push("EMAIL_SERVER_PORT");
  if (!process.env.EMAIL_SERVER_USER) missingVars.push("EMAIL_SERVER_USER");
  if (!process.env.EMAIL_SERVER_PASSWORD)
    missingVars.push("EMAIL_SERVER_PASSWORD");
  if (!process.env.EMAIL_FROM) missingVars.push("EMAIL_FROM");

  if (missingVars.length > 0) {
    console.warn(
      `AUTH_MODE is 'email' but missing required environment variables: ${missingVars.join(", ")}`,
    );
  }

  return EmailProvider({
    server: {
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT) || 587,
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    },
    from: process.env.EMAIL_FROM || "noreply@example.com",
  });
}

/**
 * Get auth providers based on current AUTH_MODE
 */
export function getAuthProviders(): Provider[] {
  const mode = getAuthMode();

  switch (mode) {
    case "oauth":
      return buildOAuthProviders();
    case "credentials":
      return [buildCredentialsProvider()];
    case "email":
      return [buildEmailProvider()];
    case "oauth-direct":
    case "standalone":
      // No NextAuth providers needed
      return [];
    default:
      console.warn(`Unknown auth mode: ${mode}, falling back to no providers`);
      return [];
  }
}

/**
 * Get available OAuth provider names for the login page
 */
export function getAvailableOAuthProviders(): string[] {
  const providers: string[] = [];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push("google");
  }

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push("github");
  }

  return providers;
}
