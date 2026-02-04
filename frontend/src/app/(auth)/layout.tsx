import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getAllSettings } from "@/lib/services/settings.service";
import { siteConfig } from "@/configs/site";
import { AuthLayoutClient } from "./AuthLayoutClient";
import { getAuthMode } from "@/types/auth-mode";
import { getLangGraphOAuthUrl } from "@/lib/auth/mode";
import { getAvailableOAuthProviders } from "@/lib/auth/providers";

export default async function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const authMode = getAuthMode();

  // Handle special modes that don't need login UI
  if (authMode === "standalone") {
    redirect("/");
  }

  if (authMode === "oauth-direct") {
    const oauthUrl = getLangGraphOAuthUrl();
    if (oauthUrl) {
      redirect(oauthUrl);
    }
    // Fallback to home if no OAuth URL configured
    redirect("/");
  }

  const globalSettings = await getAllSettings();

  // Branding fallback chain
  const logoUrl =
    globalSettings["branding.logoUrl"] || siteConfig.branding.logoPath;
  const appTitle = globalSettings["branding.appTitle"] || siteConfig.meta.title;

  // Get available OAuth providers for the login page
  const oauthProviders = getAvailableOAuthProviders();

  return (
    <AuthLayoutClient
      authMode={authMode}
      allowRegistration={globalSettings["auth.allowRegistration"]}
      registrationPolicy={globalSettings["auth.registrationPolicy"]}
      branding={{
        appName: appTitle,
        logoPath: logoUrl,
        logoWidth: siteConfig.branding.logoWidth,
        logoHeight: siteConfig.branding.logoHeight,
      }}
      oauthProviders={oauthProviders}
    >
      {children}
    </AuthLayoutClient>
  );
}
