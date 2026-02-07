"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

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
        {total}명 중 {start}-{end}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1 || isPending}
        >
          <ChevronLeft className="h-4 w-4" />
          이전
        </Button>
        <span className="text-muted-foreground text-sm">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages || isPending}
        >
          다음
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
