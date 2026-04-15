import { auth } from "@/lib/auth";
import { getFeedbacks, getFeedbackStats } from "@/lib/services/feedback.service";
import { getRubricItems } from "@/lib/services/rubric.service";
import { FeedbackTable } from "@/features/admin/components/FeedbackTable";
import { FeedbackFilters } from "@/features/admin/components/FeedbackFilters";
import { RubricManager } from "@/features/admin/components/RubricManager";
import { Pagination } from "@/features/admin/components/Pagination";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { FeedbackTabNav } from "@/features/admin/components/FeedbackTabNav";
import { getTranslations } from "next-intl/server";
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  Clock,
  BarChart3,
} from "lucide-react";

interface FeedbackPageProps {
  searchParams: Promise<{
    tab?: string;
    page?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  await auth();
  const t = await getTranslations("admin");
  const params = await searchParams;

  const tab = params.tab || "feedbacks";
  const parsedPage = Number.parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const status = (params.status || "all") as
    | "new"
    | "reviewed"
    | "resolved"
    | "all";
  const search = params.search?.trim();

  const [stats, rubricItems] = await Promise.all([
    getFeedbackStats(),
    getRubricItems(true),
  ]);

  const statCards = [
    {
      title: t("feedback.stats.total"),
      value: stats.total,
      description: t("feedback.stats.totalDesc"),
      icon: MessageSquare,
      iconTone: "bg-muted text-foreground",
    },
    {
      title: t("feedback.stats.new"),
      value: stats.new,
      description: t("feedback.stats.newDesc"),
      icon: Plus,
      iconTone: "bg-amber-500/15 text-amber-600",
    },
    {
      title: t("feedback.stats.reviewed"),
      value: stats.reviewed,
      description: t("feedback.stats.reviewedDesc"),
      icon: Clock,
      iconTone: "bg-blue-500/15 text-blue-600",
    },
    {
      title: t("feedback.stats.resolved"),
      value: stats.resolved,
      description: t("feedback.stats.resolvedDesc"),
      icon: CheckCircle2,
      iconTone: "bg-primary/15 text-primary",
    },
    ...stats.rubricAverages.map((ra) => ({
      title: ra.rubricItemName,
      value: ra.average.toFixed(1),
      description: `${t("feedback.stats.avgScore")} (n=${ra.count})`,
      icon: BarChart3,
      iconTone: "bg-muted text-foreground",
    })),
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow={t("feedback.eyebrow")}
        title={t("feedback.title")}
        description={t("feedback.description")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {t("feedback.totalBadge", { total: stats.total })}
          </Badge>
          {status !== "all" && (
            <Badge variant="secondary">
              {t("feedback.statusBadge", { status })}
            </Badge>
          )}
        </div>
      </AdminPageHeader>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.slice(0, 4).map((stat) => (
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

      {statCards.length > 4 && (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.slice(4).map((stat) => (
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
      )}

      <FeedbackTabNav activeTab={tab} />

      {tab === "feedbacks" ? (
        <FeedbackContent
          page={page}
          status={status}
          search={search}
          t={t}
        />
      ) : (
        <Card className="border-border/70 bg-card">
          <CardHeader>
            <CardTitle>{t("feedback.rubric.title")}</CardTitle>
            <CardDescription>
              {t("feedback.rubric.description")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RubricManager
              initialItems={rubricItems.map((item) => ({
                ...item,
                createdAt: item.createdAt.toISOString(),
                updatedAt: item.updatedAt.toISOString(),
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

async function FeedbackContent({
  page,
  status,
  search,
  t,
}: {
  page: number;
  status: "new" | "reviewed" | "resolved" | "all";
  search?: string;
  t: Awaited<ReturnType<typeof getTranslations<"admin">>>;
}) {
  const result = await getFeedbacks({
    page,
    pageSize: 20,
    status,
    search,
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  return (
    <Card className="border-border/70 bg-card">
      <CardHeader>
        <CardTitle>{t("feedback.listTitle")}</CardTitle>
        <CardDescription>
          {t("feedback.listDescription", { total: result.total })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FeedbackFilters />
        {result.feedbacks.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center">
            {t("feedback.noFeedback")}
          </p>
        ) : (
          <FeedbackTable
            feedbacks={result.feedbacks.map((f) => ({
              ...f,
              createdAt: f.createdAt.toISOString(),
              updatedAt: f.updatedAt.toISOString(),
              reviewedAt: f.reviewedAt?.toISOString() || null,
            }))}
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
  );
}
