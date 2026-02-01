"use client";

/**
 * TodoProgressList Component
 *
 * Displays TODO items (source: "todo") from TodoWrite tool calls.
 * Separated from TaskProgressList for cleaner architecture.
 */

import { useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  ChevronDown,
  ListTodo,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskProgressItem } from "@/types/task-progress";

// ============================================
// Constants
// ============================================

const MAX_HEIGHT = 300;

// ============================================
// Types
// ============================================

interface TodoProgressListProps {
  items: TaskProgressItem[];
  isStreaming: boolean;
}

interface TodoItemProps {
  item: TaskProgressItem;
}

// ============================================
// Status Icon Component
// ============================================

const StatusIcon = memo(function StatusIcon({
  status,
}: {
  status: TaskProgressItem["status"];
}) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />;
  }
});

// ============================================
// Single Todo Item Component
// ============================================

const TodoItemComponent = memo(function TodoItemComponent({
  item,
}: TodoItemProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 px-3 py-2 text-sm",
        "transition-colors duration-150",
        item.status === "completed" && "text-muted-foreground",
        item.status === "in_progress" && "bg-blue-50/50 dark:bg-blue-950/20"
      )}
    >
      {/* Status Icon */}
      <div className="mt-0.5">
        <StatusIcon status={item.status} />
      </div>

      {/* Content */}
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
    </div>
  );
});

// ============================================
// Main TodoProgressList Component
// ============================================

export const TodoProgressList = memo(function TodoProgressList({
  items,
  isStreaming,
}: TodoProgressListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter only todo items
  const todoItems = useMemo(
    () => items.filter((item) => item.source === "todo"),
    [items]
  );

  // Calculate totals
  const { completedCount, totalCount } = useMemo(
    () => ({
      completedCount: todoItems.filter((i) => i.status === "completed").length,
      totalCount: todoItems.length,
    }),
    [todoItems]
  );

  const hasActiveItem = todoItems.some((i) => i.status === "in_progress");

  if (todoItems.length === 0) {
    return null;
  }

  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      {/* Header */}
      <div
        className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <ChevronIcon className="h-4 w-4 text-muted-foreground" />
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Todo</span>
          <span className="text-xs text-muted-foreground">
            ({completedCount}/{totalCount})
          </span>
        </div>
        {hasActiveItem && (
          <span className="text-xs text-blue-500 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            In Progress
          </span>
        )}
      </div>

      {/* Content */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="overflow-y-auto divide-y divide-border/20"
              style={{ maxHeight: MAX_HEIGHT }}
            >
              {todoItems.map((item) => (
                <TodoItemComponent key={item.id} item={item} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default TodoProgressList;
