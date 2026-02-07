import { auth } from "@/lib/auth";
import { getUsers } from "@/lib/services/user.service";
import { UserTable } from "@/features/admin/components/UserTable";
import { UserFilters } from "@/features/admin/components/UserFilters";
import { Pagination } from "@/features/admin/components/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import type { UserRole, UserStatus } from "@/types/auth-mode";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";

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

  const parsedPage = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const status = (params.status || "all") as UserStatus | "all";
  const role = (params.role || "all") as UserRole | "all";
  const search = params.search?.trim();

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
      <AdminPageHeader
        eyebrow="사용자 관리"
        title="전체 사용자"
        description={`검색/필터 조건에 맞는 사용자 ${result.total}명`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">총 {result.total}명</Badge>
          {status !== "all" && <Badge variant="secondary">상태: {status}</Badge>}
          {role !== "all" && <Badge variant="secondary">권한: {role}</Badge>}
          {search && <Badge variant="secondary">검색: {search}</Badge>}
        </div>
      </AdminPageHeader>

      <Card className="border-border/70 bg-card/75 dark:bg-[#303030]">
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>총 {result.total}명의 사용자</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserFilters />
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
          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            totalPages={result.totalPages}
          />
        </CardContent>
      </Card>
    </div>
  );
}
