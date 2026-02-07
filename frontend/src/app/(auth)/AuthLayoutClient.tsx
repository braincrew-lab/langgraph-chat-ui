"use client";

import { ReactNode, createContext, useContext } from "react";
import { motion } from "framer-motion";
import type { AuthMode, RegistrationPolicy } from "@/types/auth-mode";

interface BrandingConfig {
  appName: string;
  logoPath: string;
  logoWidth: number;
  logoHeight: number;
}

interface AuthContextType {
  authMode: AuthMode;
  allowRegistration: boolean;
  registrationPolicy: RegistrationPolicy;
  branding: BrandingConfig;
  oauthProviders: string[];
}

const defaultBranding: BrandingConfig = {
  appName: "TeddyNote Chat",
  logoPath: "/logo.png",
  logoWidth: 28,
  logoHeight: 28,
};

const AuthContext = createContext<AuthContextType>({
  authMode: "credentials",
  allowRegistration: true,
  registrationPolicy: "open",
  branding: defaultBranding,
  oauthProviders: [],
});

export function useAuthContext() {
  return useContext(AuthContext);
}

interface AuthLayoutClientProps {
  children: ReactNode;
  authMode: AuthMode;
  allowRegistration: boolean;
  registrationPolicy: RegistrationPolicy;
  branding?: BrandingConfig;
  oauthProviders?: string[];
}

export function AuthLayoutClient({
  children,
  authMode,
  allowRegistration,
  registrationPolicy,
  branding = defaultBranding,
  oauthProviders = [],
}: AuthLayoutClientProps) {
  return (
    <AuthContext.Provider
      value={{
        authMode,
        allowRegistration,
        registrationPolicy,
        branding,
        oauthProviders,
      }}
    >
      <div className="from-background via-background to-muted/30 flex min-h-screen items-center justify-center bg-gradient-to-br px-4 py-8">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(74,144,226,0.05),transparent_50%)]" />

        {/* Auth card with animation */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94] as const,
          }}
          className="relative w-full max-w-md"
        >
          <div className="border-border/60 bg-card/80 rounded-2xl border p-8 shadow-xl shadow-black/5 backdrop-blur-sm">
            {children}
          </div>
        </motion.div>
      </div>
    </AuthContext.Provider>
  );
}
