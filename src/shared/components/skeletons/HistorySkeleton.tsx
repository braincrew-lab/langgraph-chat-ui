/**
 * HistorySkeleton - Loading skeleton for thread history
 *
 * Displays a placeholder while thread history is loading.
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface HistorySkeletonProps {
  itemCount?: number;
  className?: string;
}

export function HistorySkeleton({
  itemCount = 5,
  className,
}: HistorySkeletonProps) {
  return (
    <div className={cn("flex flex-col gap-2 p-2", className)}>
      {Array.from({ length: itemCount }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg p-3"
        >
          <Skeleton className="h-4 w-4 flex-shrink-0 rounded" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
