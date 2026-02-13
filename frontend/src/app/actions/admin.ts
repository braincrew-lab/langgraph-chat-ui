"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  getUsers,
  getUserStats,
  approveUser as approveUserService,
  suspendUser as suspendUserService,
  reactivateUser as reactivateUserService,
  deleteUser as deleteUserService,
  updateUserRole as updateUserRoleService,
} from "@/lib/services/user.service";
import {
  getAllSettings,
  getServerDefaults,
  updateSettings as updateSettingsService,
} from "@/lib/services/settings.service";
import { isAdmin, hasPermission } from "@/types/auth-mode";
import type { UserRole, UserStatus } from "@/types/auth-mode";
import type { GlobalSettings } from "@/types/global-settings";

// =============================================================================
// Types
// =============================================================================

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface AdminStatsData {
  total: number;
  active: number;
  pending: number;
  suspended: number;
  admins: number;
}

export interface AdminUserFilters {
  status?: UserStatus | "all";
  page?: number;
  pageSize?: number;
}

// =============================================================================
// Auth Helper
// =============================================================================

async function requireAdmin() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!isAdmin(session.user.role as UserRole)) {
    throw new Error("Forbidden");
  }

  return session;
}

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  if (!hasPermission(session.user.role as UserRole, "super_admin")) {
    throw new Error("Forbidden: Super admin required");
  }

  return session;
}

// =============================================================================
// User CRUD Operations
// =============================================================================

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats(): Promise<ActionResult<AdminStatsData>> {
  try {
    await requireAdmin();
    const stats = await getUserStats();
    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get stats",
    };
  }
}

/**
 * Get admin users with optional filtering
 */
export async function getAdminUsers(filters?: AdminUserFilters): Promise<
  ActionResult<{
    users: Array<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      status: string;
      createdAt: string;
      approvedAt: string | null;
      approvedBy: { name: string | null; email: string } | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>
> {
  try {
    await requireAdmin();

    const result = await getUsers({
      page: filters?.page || 1,
      pageSize: filters?.pageSize || 20,
      status: filters?.status || "all",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    return {
      success: true,
      data: {
        ...result,
        users: result.users.map((u) => ({
          ...u,
          createdAt: u.createdAt.toISOString(),
          approvedAt: u.approvedAt?.toISOString() || null,
        })),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get users",
    };
  }
}

/**
 * Approve a pending user
 */
export async function approveUser(userId: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await approveUserService(userId, session.user.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to approve user",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/approvals");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve user",
    };
  }
}

/**
 * Suspend a user
 */
export async function suspendUser(
  userId: string,
  reason?: string,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await suspendUserService(userId, session.user.id, reason);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to suspend user",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to suspend user",
    };
  }
}

/**
 * Reactivate a suspended user
 */
export async function reactivateUser(userId: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await reactivateUserService(userId, session.user.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to reactivate user",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to reactivate user",
    };
  }
}

/**
 * Delete a user
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await deleteUserService(userId, session.user.id);

    if (!result.success) {
      return { success: false, error: result.error || "Failed to delete user" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    revalidatePath("/admin/approvals");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}

/**
 * Update a user's role (super_admin only)
 */
export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();
    const result = await updateUserRoleService(userId, role, session.user.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to update user role",
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update user role",
    };
  }
}

// =============================================================================
// Settings Operations
// =============================================================================

/**
 * Get admin settings
 */
export async function getAdminSettings(): Promise<
  ActionResult<{
    settings: GlobalSettings;
    serverDefaults: GlobalSettings;
  }>
> {
  try {
    await requireAdmin();

    const [settings, serverDefaults] = await Promise.all([
      getAllSettings(),
      getServerDefaults(),
    ]);

    return {
      success: true,
      data: { settings, serverDefaults },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get settings",
    };
  }
}

/**
 * Update admin settings
 */
export async function updateAdminSettings(
  settings: Partial<GlobalSettings>,
): Promise<ActionResult<GlobalSettings>> {
  try {
    const session = await requireAdmin();

    await updateSettingsService(settings, session.user.id);
    const updatedSettings = await getAllSettings();

    // Revalidate all paths that use settings
    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/settings");
    revalidatePath("/login");
    revalidatePath("/register");

    return { success: true, data: updatedSettings };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}
