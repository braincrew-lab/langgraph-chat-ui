/**
 * MessageSkeleton - Loading skeleton for chat messages
 *
 * Displays a placeholder while message content is loading.
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface MessageSkeletonProps {
  type?: "human" | "assistant";
  className?: string;
}

export function MessageSkeleton({
  type = "assistant",
  className,
}: MessageSkeletonProps) {
  const isHuman = type === "human";

  return (
    <div
      className={cn(
        "flex gap-3 p-4",
        isHuman ? "justify-end" : "justify-start",
        className,
      )}
    >
      {!isHuman && <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />}
      <div
        className={cn(
          "flex flex-col gap-2",
          isHuman ? "items-end" : "items-start",
        )}
      >
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      {isHuman && <Skeleton className="h-8 w-8 flex-shrink-0 rounded-full" />}
    </div>
  );
}
