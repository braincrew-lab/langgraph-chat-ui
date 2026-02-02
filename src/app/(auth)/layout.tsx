import { ReactNode } from "react";
import { getAllSettings } from "@/lib/services/settings.service";
import { siteConfig } from "@/configs/site";
import { AuthLayoutClient } from "./AuthLayoutClient";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const globalSettings = await getAllSettings();

  // Branding fallback chain
  const logoUrl =
    globalSettings["branding.logoUrl"] || siteConfig.branding.logoPath;
  const appTitle = globalSettings["branding.appTitle"] || siteConfig.meta.title;

  return (
    <AuthLayoutClient
      allowRegistration={globalSettings["auth.allowRegistration"]}
      registrationPolicy={globalSettings["auth.registrationPolicy"]}
      branding={{
        appName: appTitle,
        logoPath: logoUrl,
        logoWidth: siteConfig.branding.logoWidth,
        logoHeight: siteConfig.branding.logoHeight,
      }}
    >
      {children}
    </AuthLayoutClient>
  );
}
