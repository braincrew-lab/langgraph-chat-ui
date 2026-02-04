"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useAuthContext } from "@/providers/AuthProvider";

export function useAuth() {
  const authContext = useAuthContext();

  // Standalone mode - no user, no auth
  if (authContext.isStandalone) {
    return {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isStandalone: true,
      signIn: () => Promise.resolve(undefined),
      signOut: () => Promise.resolve(),
    };
  }

  // NextAuth mode - use real session
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: session, status } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    isStandalone: false,
    signIn,
    signOut: () => signOut({ callbackUrl: "/login" }),
  };
}
