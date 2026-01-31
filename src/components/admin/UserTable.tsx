"use client";

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

export function UserTable({ users, currentUserId, currentUserRole }: UserTableProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<User | null>(null);

  const handleAction = async (
    userId: string,
    action: "approve" | "suspend" | "reactivate" | "delete"
  ) => {
    setLoading(userId);
    try {
      const response = await fetch(
        `/api/admin/users/${userId}${action === "delete" ? "" : `/${action}`}`,
        {
          method: action === "delete" ? "DELETE" : "POST",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Action failed");
      } else {
        router.refresh();
      }
    } catch {
      alert("An error occurred");
    } finally {
      setLoading(null);
      setDeleteDialog(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800">
            활성
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400 border-amber-200 dark:border-amber-800">
            대기중
          </Badge>
        );
      case "suspended":
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800">
            정지됨
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
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 border-purple-200 dark:border-purple-800">
            최고관리자
          </Badge>
        );
      case "admin":
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 border-blue-200 dark:border-blue-800">
            관리자
          </Badge>
        );
      default:
        return <Badge variant="outline">일반회원</Badge>;
    }
  };

  const canModifyUser = (user: User) => {
    // Cannot modify self
    if (user.id === currentUserId) return false;
    // Cannot modify super_admin
    if (user.role === "super_admin") return false;
    // Only super_admin can modify admins
    if (user.role === "admin" && currentUserRole !== "super_admin") return false;
    return true;
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>사용자</TableHead>
            <TableHead>권한</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>가입일</TableHead>
            <TableHead className="w-[70px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{user.name || "—"}</div>
                  <div className="text-sm text-muted-foreground">
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
                        disabled={loading === user.id}
                      >
                        {loading === user.id ? (
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
                          승인
                        </DropdownMenuItem>
                      )}
                      {user.status === "active" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(user.id, "suspend")}
                          className="text-red-600"
                        >
                          <UserX className="mr-2 h-4 w-4" />
                          정지
                        </DropdownMenuItem>
                      )}
                      {user.status === "suspended" && (
                        <DropdownMenuItem
                          onClick={() => handleAction(user.id, "reactivate")}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          재활성화
                        </DropdownMenuItem>
                      )}
                      {currentUserRole === "super_admin" && (
                        <>
                          <DropdownMenuSeparator />
                          {user.role === "user" ? (
                            <DropdownMenuItem onClick={() => {}}>
                              <Shield className="mr-2 h-4 w-4" />
                              관리자로 승격
                            </DropdownMenuItem>
                          ) : user.role === "admin" ? (
                            <DropdownMenuItem onClick={() => {}}>
                              <ShieldOff className="mr-2 h-4 w-4" />
                              일반회원으로 강등
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
                        사용자 삭제
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium">{deleteDialog?.email}</span>을(를)
              삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDialog && handleAction(deleteDialog.id, "delete")}
              className="bg-red-600 hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
