import type { Metadata } from "next";
import "./globals.css";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { siteConfig } from "@/configs/site";

const faviconPath = siteConfig.meta.favicon || siteConfig.branding.logoPath;

export const metadata: Metadata = {
  title: siteConfig.meta.title,
  description: siteConfig.meta.description,
  icons: {
    icon: faviconPath,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
