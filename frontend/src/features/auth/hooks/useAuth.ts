"use client";

import { requiresNextAuth } from "@/types/auth-mode";

interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
}

const STANDALONE_USER: AuthUser = {
  id: "anonymous",
  name: "User",
  email: null,
  role: "user",
  status: "active",
};

const needsAuth = requiresNextAuth();

// 조건부 import
let useSession: () => { data: { user?: AuthUser } | null; status: string };
let signIn: () => Promise<unknown>;
let signOut: (opts: { callbackUrl: string }) => Promise<void>;

if (needsAuth) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nextAuth = require("next-auth/react");
  useSession = nextAuth.useSession;
  signIn = nextAuth.signIn;
  signOut = nextAuth.signOut;
}

export function useAuth() {
  if (!needsAuth) {
    return {
      user: STANDALONE_USER as AuthUser | null,
      isLoading: false,
      isAuthenticated: true,
      signIn: () => Promise.resolve(undefined),
      signOut: () => Promise.resolve(),
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: session, status } = useSession();

  return {
    user: (session?.user ?? null) as AuthUser | null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    signIn,
    signOut: () => signOut({ callbackUrl: "/login" }),
  };
}
