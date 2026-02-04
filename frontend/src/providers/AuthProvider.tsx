"use client";

import { ReactNode } from "react";
import { requiresNextAuth } from "@/types/auth-mode";

// 조건부 import를 위한 동적 컴포넌트
let SessionProviderComponent: React.ComponentType<{ children: ReactNode }> | null = null;

if (requiresNextAuth()) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SessionProvider } = require("next-auth/react");
  SessionProviderComponent = SessionProvider;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!requiresNextAuth() || !SessionProviderComponent) {
    return <>{children}</>;
  }
  return <SessionProviderComponent>{children}</SessionProviderComponent>;
}
