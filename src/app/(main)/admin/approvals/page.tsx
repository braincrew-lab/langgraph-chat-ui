import { auth } from "@/lib/auth";
import { getUsers } from "@/lib/services/user.service";
import { UserTable } from "@/features/admin/components/UserTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import type { UserRole } from "@/types/auth-mode";
import { AlertCircle } from "lucide-react";

export default async function ApprovalsPage() {
  const session = await auth();

  const result = await getUsers({
    page: 1,
    pageSize: 100,
    status: "pending",
    sortBy: "createdAt",
    sortOrder: "asc",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">승인 대기</h1>
        <p className="text-muted-foreground">
          회원가입 요청을 검토하고 승인합니다
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>대기 중인 사용자</CardTitle>
          <CardDescription>
            {result.total}명의 사용자가 승인 대기 중
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg">대기 중인 요청이 없습니다</h3>
              <p className="text-muted-foreground text-sm mt-1">
                모든 가입 요청이 처리되었습니다
              </p>
            </div>
          ) : (
            <UserTable
              users={result.users.map((u) => ({
                ...u,
                createdAt: u.createdAt.toISOString(),
                approvedAt: u.approvedAt?.toISOString() || null,
              }))}
              currentUserId={session!.user.id}
              currentUserRole={session!.user.role as UserRole}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
