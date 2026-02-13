import { auth } from "@/lib/auth";
import { getUserStats } from "@/lib/services/user.service";
import { getAuthModeConfig } from "@/lib/auth/mode";
import { getAllSettings } from "@/lib/services/settings.service";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  ArrowRight,
  Clock,
  Settings2,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { getTranslations } from "next-intl/server";

export default async function AdminDashboardPage() {
  const [session, stats, settings, t, tc] = await Promise.all([
    auth(),
    getUserStats(),
    getAllSettings(),
    getTranslations('admin'),
    getTranslations('common'),
  ]);
  const config = getAuthModeConfig();

  const statCards = [
    {
      title: t('dashboard.totalUsers'),
      value: stats.total,
      description: t('dashboard.registeredAccounts'),
      icon: Users,
      iconTone: "bg-muted text-foreground",
    },
    {
      title: t('dashboard.activeUsers'),
      value: stats.active,
      description: t('dashboard.normalUsage'),
      icon: UserCheck,
      iconTone: "bg-primary/15 text-primary",
    },
    {
      title: t('dashboard.pendingApproval'),
      value: stats.pending,
      description: t('dashboard.reviewRequired'),
      icon: Clock,
      iconTone: "bg-muted text-foreground",
    },
    {
      title: t('dashboard.suspended'),
      value: stats.suspended,
      description: t('dashboard.actionRequired'),
      icon: UserX,
      iconTone: "bg-destructive/15 text-destructive",
    },
    {
      title: t('dashboard.admins'),
      value: stats.admins,
      description: t('dashboard.adminAccounts'),
      icon: Shield,
      iconTone: "bg-muted text-foreground",
    },
  ];

  const activeRatio =
    stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0;
  const getToggleLabel = (enabled: boolean) => (enabled ? tc('enabled') : tc('disabled'));

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "public":
        return t('dashboard.publicMode');
      case "authenticated":
        return t('dashboard.authenticatedMode');
      default:
        return mode;
    }
  };

  const getPolicyLabel = (policy: string) => {
    switch (policy) {
      case "open":
        return t('dashboard.openRegistration');
      case "approval":
        return t('dashboard.approvalRequired');
      default:
        return policy;
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        trailing={t('dashboard.manager', { name: session?.user?.name || session?.user?.email || '' })}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t('dashboard.activeRatio', { ratio: activeRatio })}</Badge>
          <Badge variant="secondary">{t('dashboard.pendingCount', { count: stats.pending })}</Badge>
          <Badge variant="secondary">{t('dashboard.suspendedCount', { count: stats.suspended })}</Badge>
        </div>
      </AdminPageHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => (
          <Card
            key={stat.title}
            className="border-border/70 bg-card overflow-hidden"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.iconTone}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-muted-foreground text-xs">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card h-fit self-start">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{t('dashboard.systemSettings')}</CardTitle>
                <CardDescription>{t('dashboard.settingsSummary')}</CardDescription>
              </div>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 border-0 px-2 shadow-none"
              >
                <Link href="/admin/settings">
                  {t('dashboard.goTo')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.authMode')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getModeLabel(config.mode)}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.allowRegistration')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["auth.allowRegistration"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.registrationPolicy')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getPolicyLabel(settings["auth.registrationPolicy"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.fileUpload')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.enableFileUpload"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.chatHistory')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.showHistory"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.threadDeletion')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.enableDeletion"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.advancedInput')}
                </dt>
                <dd className="text-sm font-semibold">
                  {getToggleLabel(settings["features.enableAdvancedInput"])}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.defaultGraphId')}
                </dt>
                <dd className="text-sm font-semibold">
                  {settings["features.defaultGraphId"] || tc('notSet')}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-sm font-medium">
                  {t('dashboard.defaultConnectionApi')}
                </dt>
                <dd className="max-w-full text-sm font-semibold break-all">
                  {settings["features.defaultConnectionApiUrl"] || tc('notSet')}
                </dd>
              </div>
              {config.initialAdminEmail && (
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-muted-foreground text-sm font-medium">
                    {t('dashboard.initialAdminEmail')}
                  </dt>
                  <dd className="text-sm font-semibold">
                    {config.initialAdminEmail}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle>{t('dashboard.operationAlerts')}</CardTitle>
            <CardDescription>{t('dashboard.alertsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-accent flex items-start gap-3 rounded-lg border p-3">
              <UserPlus className="text-primary mt-0.5 h-4 w-4" />
              <div className="text-sm">
                <p className="font-medium">{t('dashboard.pendingRequests')}</p>
                <p className="text-muted-foreground">
                  {t('dashboard.pendingRequestsDesc', { count: stats.pending })}
                </p>
              </div>
            </div>
            <div className="bg-accent flex items-start gap-3 rounded-lg border p-3">
              <Settings2 className="text-muted-foreground mt-0.5 h-4 w-4" />
              <div className="text-sm">
                <p className="font-medium">{t('dashboard.operationCheck')}</p>
                <p className="text-muted-foreground">
                  {t('dashboard.operationCheckDesc', { suspended: stats.suspended, admins: stats.admins })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
