"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type TodoItem } from "@/types/task-hierarchy";

interface TodoListProps {
  items: TodoItem[];
  isStreaming: boolean;
}

const StatusIcon = ({ status }: { status: TodoItem["status"] }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  }
};

export function TodoList({ items, isStreaming }: TodoListProps) {
  if (items.length === 0) {
    return null;
  }

  const completedCount = items.filter((item) => item.status === "completed").length;
  const totalCount = items.length;

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Todo</span>
          <span className="text-xs text-muted-foreground">
            ({completedCount}/{totalCount})
          </span>
        </div>
        {isStreaming && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            진행 중
          </span>
        )}
      </div>
      <div className="divide-y divide-border/30">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={`${item.id || "item"}-${index}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "flex items-start gap-2 px-3 py-2 text-sm",
                item.status === "completed" && "text-muted-foreground",
                item.status === "in_progress" && "bg-blue-50/50 dark:bg-blue-950/20"
              )}
            >
              <div className="mt-0.5">
                <StatusIcon status={item.status} />
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={cn(
                    item.status === "completed" && "line-through",
                    item.status === "in_progress" && "font-medium text-foreground"
                  )}
                >
                  {item.status === "in_progress" && item.activeForm
                    ? item.activeForm
                    : item.content}
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
