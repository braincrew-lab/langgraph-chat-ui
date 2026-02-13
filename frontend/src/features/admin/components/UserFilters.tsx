"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useTranslations } from "next-intl";

export function UserFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useTranslations("admin");

  const currentStatus = searchParams.get("status") || "all";
  const currentRole = searchParams.get("role") || "all";
  const currentSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(currentSearch);

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "all") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }

      // Reset to page 1 when filters change
      params.delete("page");

      startTransition(() => {
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      });
    },
    [pathname, router, searchParams, startTransition],
  );

  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateParams({ search: searchInput.trim() });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, updateParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder={t("filters.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9"
        />
      </div>

      <Select
        value={currentStatus}
        onValueChange={(value) => updateParams({ status: value })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder={t("filters.allStatus")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filters.allStatus")}</SelectItem>
          <SelectItem value="active">{t("filters.active")}</SelectItem>
          <SelectItem value="pending">{t("filters.pending")}</SelectItem>
          <SelectItem value="suspended">{t("filters.suspended")}</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={currentRole}
        onValueChange={(value) => updateParams({ role: value })}
      >
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder={t("filters.allRoles")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("filters.allRoles")}</SelectItem>
          <SelectItem value="user">{t("filters.user")}</SelectItem>
          <SelectItem value="admin">{t("filters.admin")}</SelectItem>
          <SelectItem value="super_admin">{t("filters.superAdmin")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
