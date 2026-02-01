/**
 * ThreadSkeleton - Loading skeleton for chat thread
 *
 * Displays a placeholder while thread content is loading.
 */

import { cn } from "@/lib/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { MessageSkeleton } from "./MessageSkeleton";

interface ThreadSkeletonProps {
  messageCount?: number;
  className?: string;
}

export function ThreadSkeleton({
  messageCount = 3,
  className,
}: ThreadSkeletonProps) {
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-4 p-4">
          {Array.from({ length: messageCount }).map((_, i) => (
            <MessageSkeleton
              key={i}
              type={i % 2 === 0 ? "human" : "assistant"}
            />
          ))}
        </div>
      </div>

      {/* Input area skeleton */}
      <div className="border-t p-4">
        <div className="flex gap-2 items-center">
          <Skeleton className="flex-1 h-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
