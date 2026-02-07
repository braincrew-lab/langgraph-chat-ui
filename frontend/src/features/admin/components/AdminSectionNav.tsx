"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings2, UserCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "대시보드",
    icon: LayoutDashboard,
    matches: (pathname: string) => pathname === "/admin",
  },
  {
    href: "/admin/users",
    label: "사용자",
    icon: Users,
    matches: (pathname: string) => pathname.startsWith("/admin/users"),
  },
  {
    href: "/admin/approvals",
    label: "승인 요청",
    icon: UserCheck,
    matches: (pathname: string) => pathname.startsWith("/admin/approvals"),
  },
  {
    href: "/admin/settings",
    label: "설정",
    icon: Settings2,
    matches: (pathname: string) => pathname.startsWith("/admin/settings"),
  },
];

export function AdminSectionNav() {
  const pathname = usePathname() || "";

  return (
    <nav
      aria-label="관리자 섹션"
      className="border-border/70 bg-card/70 dark:bg-[#2f2f2f] rounded-xl border p-2"
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {NAV_ITEMS.map((item) => {
          const active = item.matches(pathname);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground hover:bg-accent/70",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
