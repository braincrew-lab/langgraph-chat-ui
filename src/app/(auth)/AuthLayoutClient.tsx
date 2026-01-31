"use client";

import { ReactNode, createContext, useContext } from "react";
import { motion } from "framer-motion";
import type { RegistrationPolicy } from "@/types/auth-mode";

interface AuthContextType {
  allowRegistration: boolean;
  registrationPolicy: RegistrationPolicy;
}

const AuthContext = createContext<AuthContextType>({
  allowRegistration: true,
  registrationPolicy: "open",
});

export function useAuthContext() {
  return useContext(AuthContext);
}

interface AuthLayoutClientProps {
  children: ReactNode;
  allowRegistration: boolean;
  registrationPolicy: RegistrationPolicy;
}

export function AuthLayoutClient({ children, allowRegistration, registrationPolicy }: AuthLayoutClientProps) {
  return (
    <AuthContext.Provider value={{ allowRegistration, registrationPolicy }}>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 px-4 py-8">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(74,144,226,0.05),transparent_50%)]" />

        {/* Auth card with animation */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: 0.4,
            ease: [0.25, 0.46, 0.45, 0.94] as const
          }}
          className="relative w-full max-w-md"
        >
          <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8 shadow-xl shadow-black/5">
            {children}
          </div>
        </motion.div>
      </div>
    </AuthContext.Provider>
  );
}
