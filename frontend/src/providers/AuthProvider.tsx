"use client";

import { SessionProvider } from "next-auth/react";
import { createContext, ReactNode, useContext } from "react";

// Auth context for standalone mode
interface StandaloneAuthContextValue {
  isStandalone: true;
}

interface NextAuthContextValue {
  isStandalone: false;
}

type AuthContextValue = StandaloneAuthContextValue | NextAuthContextValue;

const AuthContext = createContext<AuthContextValue>({ isStandalone: false });

export function useAuthContext() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

// NextAuth provider (for credentials, oauth, email modes)
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ isStandalone: false }}>
      <SessionProvider>{children}</SessionProvider>
    </AuthContext.Provider>
  );
}

// Standalone provider (no auth required)
export function StandaloneAuthProvider({ children }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ isStandalone: true }}>
      {children}
    </AuthContext.Provider>
  );
}
