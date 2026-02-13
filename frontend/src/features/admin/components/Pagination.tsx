"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useTranslations } from "next-intl";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function Pagination({
  page,
  pageSize,
  total,
  totalPages,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('admin');
  const tc = useTranslations('common');

  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage === 1) {
      params.delete("page");
    } else {
      params.set("page", String(newPage));
    }
    startTransition(() => {
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-muted-foreground text-sm">
        {t('pagination.showing', { total, start, end })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || isPending}
        >
          <ChevronLeft className="h-4 w-4" />
          {tc('previous')}
        </Button>
        <span className="text-muted-foreground text-sm">
          {t('pagination.pageOf', { page, totalPages })}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages || isPending}
        >
          {tc('next')}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
