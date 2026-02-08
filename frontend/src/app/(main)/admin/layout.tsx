import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";
import { Badge } from "@/shared/components/ui/badge";
import { Shield } from "lucide-react";
import { AdminSectionNav } from "@/features/admin/components/AdminSectionNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Check if user is admin
  if (!session?.user || !isAdmin(session.user.role as UserRole)) {
    redirect("/");
  }

  // Just render children - sidebar is in the shared (main) layout
  return (
    <div className="from-card to-muted/20 h-full overflow-y-auto bg-gradient-to-b">
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-16 lg:px-8">
        <div className="border-border/70 bg-card mb-4 rounded-2xl border px-5 py-4 shadow-sm backdrop-blur-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
                <Shield className="h-3.5 w-3.5" />
                Admin Console
              </div>
              <h1 className="text-xl font-semibold tracking-tight">
                관리자 페이지
              </h1>
              <p className="text-muted-foreground text-sm">
                사용자, 승인 요청, 전역 설정을 관리합니다.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-background/70 dark:bg-muted"
              >
                {session.user.role === "super_admin" ? "최고 관리자" : "관리자"}
              </Badge>
              <Badge
                variant="secondary"
                className="max-w-[240px] truncate"
              >
                {session.user.name || session.user.email}
              </Badge>
            </div>
          </div>
        </div>

        <AdminSectionNav />

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
