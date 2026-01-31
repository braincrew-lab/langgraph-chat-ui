"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { isAdmin, hasPermission } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";

interface UseAdminAuthOptions {
  requiredRole?: UserRole;
  redirectTo?: string;
}

export function useAdminAuth(options: UseAdminAuthOptions = {}) {
  const { requiredRole = "admin", redirectTo = "/" } = options;
  const { data: session, status } = useSession();
  const router = useRouter();

  const userRole = (session?.user?.role || "user") as UserRole;
  const isAuthorized =
    status === "authenticated" &&
    (requiredRole === "admin"
      ? isAdmin(userRole)
      : hasPermission(userRole, requiredRole));

  useEffect(() => {
    if (status === "loading") return;

    if (!isAuthorized) {
      router.replace(redirectTo);
    }
  }, [status, isAuthorized, router, redirectTo]);

  return {
    session,
    status,
    isAuthorized,
    isLoading: status === "loading",
    userRole,
    isSuperAdmin: userRole === "super_admin",
    isAdmin: isAdmin(userRole),
  };
}
