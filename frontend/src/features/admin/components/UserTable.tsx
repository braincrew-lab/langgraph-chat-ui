"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
  Shield,
  ShieldOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  approveUser,
  suspendUser,
  reactivateUser,
  deleteUser,
  updateUserRole,
} from "@/app/actions/admin";
import type { UserRole } from "@/types/auth-mode";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: { name: string | null; email: string } | null;
}

interface UserTableProps {
  users: User[];
  currentUserId: string;
  currentUserRole: UserRole;
}

export function UserTable({
  users,
  currentUserId,
  currentUserRole,
}: UserTableProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<User | null>(null);

  const handleAction = async (
    userId: string,
    action: "approve" | "suspend" | "reactivate" | "delete",
  ) => {
    setLoadingUserId(userId);

    startTransition(async () => {
      try {
        let result;
        switch (action) {
          case "approve":
            result = await approveUser(userId);
            break;
          case "suspend":
            result = await suspendUser(userId);
            break;
          case "reactivate":
            result = await reactivateUser(userId);
            break;
          case "delete":
            result = await deleteUser(userId);
            break;
        }

        if (!result.success) {
          alert(result.error || "Action failed");
        } else {
          router.refresh();
        }
      } catch {
        alert("An error occurred");
      } finally {
        setLoadingUserId(null);
        setDeleteDialog(null);
      }
    });
  };

  const handleRoleChange = async (
    userId: string,
    newRole: "admin" | "user",
  ) => {
    setLoadingUserId(userId);

    startTransition(async () => {
      try {
        const result = await updateUserRole(userId, newRole);

        if (!result.success) {
          alert(result.error || "Role change failed");
        } else {
          router.refresh();
        }
      } catch {
        alert("An error occurred");
      } finally {
        setLoadingUserId(null);
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/50 dark:text-green-400">
            {t("table.active")}
          </Badge>
        );
      case "pending":
        return (
          <Badge className="border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-400">
            {t("table.pendingStatus")}
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/50 dark:text-red-400">
            {t("table.suspendedStatus")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "super_admin":
        return (
          <Badge className="border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-900/50 dark:text-purple-400">
            {t("table.superAdmin")}
          </Badge>
        );
      case "admin":
        return (
          <Badge className="border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/50 dark:text-blue-400">
            {t("table.adminRole")}
          </Badge>
        );
      default:
        return <Badge variant="outline">{t("table.userRole")}</Badge>;
    }
  };

  const canModifyUser = (user: User) => {
    // Cannot modify self
    if (user.id === currentUserId) return false;
    // Cannot modify super_admin
    if (user.role === "super_admin") return false;
    // Only super_admin can modify admins
    if (user.role === "admin" && currentUserRole !== "super_admin")
      return false;
    return true;
  };

  const isLoading = (userId: string) => isPending && loadingUserId === userId;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.name")}</TableHead>
            <TableHead>{t("table.role")}</TableHead>
            <TableHead>{t("table.status")}</TableHead>
            <TableHead>{t("table.joined")}</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{user.name || "—"}</div>
                  <div className="text-muted-foreground text-sm">
                    {user.email}
                  </div>
                </div>
              </TableCell>
              <TableCell>{getRoleBadge(user.role)}</TableCell>
              <TableCell>{getStatusBadge(user.status)}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(user.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                {canModifyUser(user) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={isLoading(user.id)}
                      >
                        {isLoading(user.id) ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {user.status === "pending" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(user.id, "approve")}
                        >
                          <UserCheck className="mr-2 h-4 w-4" />
                          {t("table.approve")}
                        </DropdownMenuItem>
                      )}
                      {user.status === "active" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(user.id, "suspend")}
                          className="text-red-600"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          {t("table.suspend")}
                        </DropdownMenuItem>
                      )}
                      {user.status === "suspended" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(user.id, "reactivate")}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          {t("table.reactivate")}
                        </DropdownMenuItem>
                      )}
                      {currentUserRole === "super_admin" && (
                        <>
                          <DropdownMenuSeparator />
                          {user.role === "user" ? (
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.id, "admin")}
                            >
                              <Shield className="mr-2 h-4 w-4" />
                              {t("table.promoteToAdmin")}
                            </DropdownMenuItem>
                          ) : user.role === "admin" ? (
                            <DropdownMenuItem
                              onClick={() => handleRoleChange(user.id, "user")}
                            >
                              <ShieldOff className="mr-2 h-4 w-4" />
                              {t("table.demoteToUser")}
                            </DropdownMenuItem>
                          ) : null}
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteDialog(user)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("table.deleteUser")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={() => setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("table.deleteUser")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("table.deleteConfirm", { email: deleteDialog?.email || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteDialog && handleAction(deleteDialog.id, "delete")
              }
              className="bg-red-600 hover:bg-red-700"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
