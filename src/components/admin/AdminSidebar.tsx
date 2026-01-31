"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Settings,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface AdminSidebarProps {
  pendingCount?: number;
}

export function AdminSidebar({ pendingCount = 0 }: AdminSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const navItems: NavItem[] = [
    {
      href: "/admin",
      label: "대시보드",
      icon: LayoutDashboard,
    },
    {
      href: "/admin/users",
      label: "사용자 관리",
      icon: Users,
    },
    {
      href: "/admin/approvals",
      label: "승인 대기",
      icon: UserCheck,
      badge: pendingCount,
    },
    {
      href: "/admin/settings",
      label: "설정",
      icon: Settings,
    },
  ];

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-14 items-center border-b px-4">
        <Shield className="mr-2 h-5 w-5 text-primary" />
        <span className="font-semibold">관리자</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center">
                <item.icon className="mr-3 h-4 w-4" />
                {item.label}
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <div className="mb-3 text-xs text-muted-foreground">
          로그인:{" "}
          <span className="font-medium text-foreground">
            {session?.user?.email}
          </span>
        </div>
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            앱으로 돌아가기
          </Link>
        </Button>
      </div>
    </div>
  );
}
