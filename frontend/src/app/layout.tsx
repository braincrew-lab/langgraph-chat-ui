import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { siteConfig } from "@/configs/site";
import { AuthProvider, StandaloneAuthProvider } from "@/providers/AuthProvider";
import { getAllSettings } from "@/lib/services/settings.service";
import { requiresNextAuth } from "@/types/auth-mode";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getAllSettings();

    // Branding fallback chain
    const logoUrl =
      settings["branding.logoUrl"] || siteConfig.branding.logoPath;
    const faviconUrl = settings["branding.faviconUrl"] || logoUrl;
    const appTitle = settings["branding.appTitle"] || siteConfig.meta.title;

    return {
      title: appTitle,
      description: siteConfig.meta.description,
      icons: {
        icon: faviconUrl,
      },
    };
  } catch {
    // Fallback to static config if DB is unavailable
    const faviconPath = siteConfig.meta.favicon || siteConfig.branding.logoPath;
    return {
      title: siteConfig.meta.title,
      description: siteConfig.meta.description,
      icons: {
        icon: faviconPath,
      },
    };
  }
}

// Default favicon path for immediate rendering (prevents flickering)
const defaultFaviconPath =
  siteConfig.meta.favicon || siteConfig.branding.logoPath;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const needsAuth = requiresNextAuth();

  return (
    <html
      lang="ko"
      suppressHydrationWarning
    >
      <head>
        {/* Static default favicon to prevent flickering during async metadata loading */}
        <link
          rel="icon"
          href={defaultFaviconPath}
        />
      </head>
      <body suppressHydrationWarning>
        {needsAuth ? (
          <AuthProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </AuthProvider>
        ) : (
          <StandaloneAuthProvider>
            <NuqsAdapter>{children}</NuqsAdapter>
          </StandaloneAuthProvider>
        )}
      </body>
    </html>
  );
}
