import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { siteConfig } from "@/configs/site";
import { AuthProvider, StandaloneAuthProvider } from "@/providers/AuthProvider";
import { getAllSettings } from "@/lib/services/settings.service";
import { usesNextAuth } from "@/types/auth-mode";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [settings, t] = await Promise.all([
      getAllSettings(),
      getTranslations("defaults"),
    ]);

    // Branding fallback chain
    const logoUrl =
      settings["branding.logoUrl"] || siteConfig.branding.logoPath;
    const faviconUrl = settings["branding.faviconUrl"] || logoUrl;
    const appTitle = settings["branding.appTitle"] || siteConfig.meta.title;

    return {
      title: appTitle,
      description: t("metaDescription"),
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const needsAuth = usesNextAuth();
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
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
        <NextIntlClientProvider messages={messages}>
          {needsAuth ? (
            <AuthProvider>
              <NuqsAdapter>{children}</NuqsAdapter>
            </AuthProvider>
          ) : (
            <StandaloneAuthProvider>
              <NuqsAdapter>{children}</NuqsAdapter>
            </StandaloneAuthProvider>
          )}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
