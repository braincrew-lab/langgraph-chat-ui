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
import type { UserRole, UserStatus } from "@/types/auth-mode";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    role?: string;
    search?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const session = await auth();
  const params = await searchParams;

  const page = parseInt(params.page || "1");
  const status = (params.status || "all") as UserStatus | "all";
  const role = (params.role || "all") as UserRole | "all";
  const search = params.search;

  const result = await getUsers({
    page,
    pageSize: 20,
    status,
    role,
    search,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">사용자 관리</h1>
        <p className="text-muted-foreground">등록된 모든 사용자를 관리합니다</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>전체 사용자</CardTitle>
          <CardDescription>총 {result.total}명의 사용자</CardDescription>
        </CardHeader>
        <CardContent>
          {result.users.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              사용자가 없습니다
            </p>
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
