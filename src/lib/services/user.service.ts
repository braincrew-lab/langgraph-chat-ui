import { prisma } from "@/lib/auth/prisma";
import type { UserRole, UserStatus } from "@/types/auth-mode";

export interface UserListParams {
  page?: number;
  pageSize?: number;
  status?: UserStatus | "all";
  role?: UserRole | "all";
  search?: string;
  sortBy?: "createdAt" | "email" | "name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface UserListResult {
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    status: string;
    createdAt: Date;
    approvedAt: Date | null;
    approvedBy: { name: string | null; email: string } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get paginated list of users with filtering
 */
export async function getUsers(params: UserListParams = {}): Promise<UserListResult> {
  const {
    page = 1,
    pageSize = 20,
    status = "all",
    role = "all",
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const where: Record<string, unknown> = {};

  if (status !== "all") {
    where.status = status;
  }

  if (role !== "all") {
    where.role = role;
  }

  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        approvedAt: true,
        approvedBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get single user by ID
 */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
      approvedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

/**
 * Approve a pending user
 */
export async function approveUser(
  userId: string,
  approvedById: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (user.status !== "pending") {
    return { success: false, error: "User is not pending approval" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "active",
      approvedAt: new Date(),
      approvedById,
    },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: approvedById,
      action: "user.approve",
      target: userId,
      details: JSON.stringify({ newStatus: "active" }),
    },
  });

  return { success: true };
}

/**
 * Suspend a user
 */
export async function suspendUser(
  userId: string,
  suspendedById: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  // Prevent suspending super_admin
  if (user.role === "super_admin") {
    return { success: false, error: "Cannot suspend a super admin" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "suspended" },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: suspendedById,
      action: "user.suspend",
      target: userId,
      details: JSON.stringify({ reason }),
    },
  });

  return { success: true };
}

/**
 * Reactivate a suspended user
 */
export async function reactivateUser(
  userId: string,
  reactivatedById: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });

  if (!user) {
    return { success: false, error: "User not found" };
  }

  if (user.status !== "suspended") {
    return { success: false, error: "User is not suspended" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: "active" },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: reactivatedById,
      action: "user.reactivate",
      target: userId,
    },
  });

  return { success: true };
}

/**
 * Update user role
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  updatedById: string
): Promise<{ success: boolean; error?: string }> {
  const [user, updater] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }),
    prisma.user.findUnique({
      where: { id: updatedById },
      select: { role: true },
    }),
  ]);

  if (!user || !updater) {
    return { success: false, error: "User not found" };
  }

  // Only super_admin can change roles
  if (updater.role !== "super_admin") {
    return { success: false, error: "Only super admins can change user roles" };
  }

  // Cannot change own role
  if (userId === updatedById) {
    return { success: false, error: "Cannot change your own role" };
  }

  // Cannot demote another super_admin
  if (user.role === "super_admin" && newRole !== "super_admin") {
    return { success: false, error: "Cannot demote a super admin" };
  }

  const oldRole = user.role;

  await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: updatedById,
      action: "user.roleChange",
      target: userId,
      details: JSON.stringify({ oldRole, newRole }),
    },
  });

  return { success: true };
}

/**
 * Delete a user
 */
export async function deleteUser(
  userId: string,
  deletedById: string
): Promise<{ success: boolean; error?: string }> {
  const [user, deleter] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    }),
    prisma.user.findUnique({
      where: { id: deletedById },
      select: { role: true },
    }),
  ]);

  if (!user || !deleter) {
    return { success: false, error: "User not found" };
  }

  // Cannot delete self
  if (userId === deletedById) {
    return { success: false, error: "Cannot delete your own account" };
  }

  // Cannot delete super_admin
  if (user.role === "super_admin") {
    return { success: false, error: "Cannot delete a super admin" };
  }

  // Only super_admin can delete admins
  if (user.role === "admin" && deleter.role !== "super_admin") {
    return { success: false, error: "Only super admins can delete admins" };
  }

  await prisma.user.delete({
    where: { id: userId },
  });

  // Log the action
  await prisma.auditLog.create({
    data: {
      userId: deletedById,
      action: "user.delete",
      target: userId,
      details: JSON.stringify({ deletedEmail: user.email }),
    },
  });

  return { success: true };
}

/**
 * Get user statistics
 */
export async function getUserStats() {
  const [total, pending, active, suspended, admins] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "pending" } }),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { status: "suspended" } }),
    prisma.user.count({
      where: { role: { in: ["admin", "super_admin"] } },
    }),
  ]);

  return {
    total,
    pending,
    active,
    suspended,
    admins,
  };
}
