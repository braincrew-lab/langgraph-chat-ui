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
import { Badge } from "@/shared/components/ui/badge";
import type { UserRole } from "@/types/auth-mode";
import { AlertCircle } from "lucide-react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { getTranslations } from "next-intl/server";

export default async function ApprovalsPage() {
  const session = await auth();
  const t = await getTranslations('admin');

  const result = await getUsers({
    page: 1,
    pageSize: 100,
    status: "pending",
    sortBy: "createdAt",
    sortOrder: "asc",
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t('approvals.eyebrow')}
        title={t('approvals.title')}
        description={t('approvals.description')}
      >
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t('approvals.pendingBadge', { total: result.total })}</Badge>
        </div>
      </AdminPageHeader>

      <Card className="border-border/70 bg-card">
        <CardHeader>
          <CardTitle>{t('approvals.listTitle')}</CardTitle>
          <CardDescription>
            {t('approvals.listDescription', { total: result.total })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {result.users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="text-muted-foreground/50 mb-4 h-12 w-12" />
              <h3 className="text-lg font-medium">{t('approvals.noRequests')}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {t('approvals.allProcessed')}
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
