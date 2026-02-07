import { Skeleton } from "@/shared/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

export default function AdminDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* AdminPageHeader skeleton */}
      <section className="border-border/70 bg-card rounded-xl border px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-1 h-7 w-40" />
            <Skeleton className="mt-1 h-4 w-72" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      </section>

      {/* Stats Grid Skeleton */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card
            key={i}
            className="border-border/70 bg-card overflow-hidden"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-12" />
              <Skeleton className="mt-1 h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Two-column section skeleton */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* System Settings Card Skeleton */}
        <Card className="border-border/70 bg-card h-fit self-start">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="mt-1 h-4 w-44" />
              </div>
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="space-y-1"
                >
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-28" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Operational Alerts Card Skeleton */}
        <Card className="border-border/70 bg-card">
          <CardHeader>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="mt-1 h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-accent flex items-start gap-3 rounded-lg border p-3"
              >
                <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
