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
  appName: "LangGraph Chat UI",
  logoPath: "/logo.svg",
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
        {/* Auth card with animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.24,
            ease: [0.22, 1, 0.36, 1] as const,
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
