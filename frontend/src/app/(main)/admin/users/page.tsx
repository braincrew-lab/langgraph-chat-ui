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
import { getTranslations } from "next-intl/server";

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
  const t = await getTranslations('admin');
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
        eyebrow={t('users.eyebrow')}
        title={t('users.title')}
        description={t('users.description', { total: result.total })}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t('users.totalBadge', { total: result.total })}</Badge>
          {status !== "all" && (
            <Badge variant="secondary">{t('users.statusBadge', { status })}</Badge>
          )}
          {role !== "all" && <Badge variant="secondary">{t('users.roleBadge', { role })}</Badge>}
          {search && <Badge variant="secondary">{t('users.searchBadge', { search })}</Badge>}
        </div>
      </AdminPageHeader>

      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle>{t('users.listTitle')}</CardTitle>
          <CardDescription>{t('users.listDescription', { total: result.total })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UserFilters />
          {result.users.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              {t('users.noUsers')}
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
