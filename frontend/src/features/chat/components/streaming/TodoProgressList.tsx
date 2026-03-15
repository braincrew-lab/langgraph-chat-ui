"use client";

/**
 * TodoProgressList Component
 *
 * Displays TODO items (source: "todo") from TodoWrite tool calls.
 * Separated from TaskProgressList for cleaner architecture.
 */

import { useState, useMemo, memo, useRef, useEffect } from "react";
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

const MAX_HEIGHT = 200;

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
      return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />;
    case "in_progress":
      return (
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
      );
    case "pending":
    default:
      return (
        <Circle className="text-muted-foreground/50 h-4 w-4 flex-shrink-0" />
      );
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
      data-todo-status={item.status}
      className={cn(
        "flex items-start gap-2 px-3 py-1.5 text-sm",
        "transition-colors duration-150",
        item.status === "completed" && "text-muted-foreground",
        item.status === "in_progress" && "bg-blue-50/50 dark:bg-blue-950/20",
      )}
    >
      {/* Status Icon */}
      <div className="mt-0.5">
        <StatusIcon status={item.status} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <span
          className={cn(
            item.status === "completed" && "line-through",
            item.status === "in_progress" && "text-foreground font-medium",
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter only todo items
  const todoItems = useMemo(
    () => items.filter((item) => item.source === "todo"),
    [items],
  );

  // Track active item for auto-scroll
  const activeItemId = useMemo(() => {
    const active = todoItems.find((i) => i.status === "in_progress");
    return active?.id;
  }, [todoItems]);

  // Auto-expand when there's an active item
  useEffect(() => {
    if (activeItemId && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [activeItemId, isCollapsed]);

  // Auto-scroll to active item (delay for AnimatePresence animation)
  useEffect(() => {
    if (!activeItemId || isCollapsed) return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const activeEl = container.querySelector(
        '[data-todo-status="in_progress"]',
      );
      if (!activeEl) return;

      const containerRect = container.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();

      if (itemRect.bottom > containerRect.bottom) {
        container.scrollTop += itemRect.bottom - containerRect.bottom + 20;
      } else if (itemRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - itemRect.top + 20;
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [activeItemId, isCollapsed]);

  // Calculate totals
  const { completedCount, totalCount } = useMemo(
    () => ({
      completedCount: todoItems.filter((i) => i.status === "completed").length,
      totalCount: todoItems.length,
    }),
    [todoItems],
  );

  const hasActiveItem = todoItems.some((i) => i.status === "in_progress");

  if (todoItems.length === 0) {
    return null;
  }

  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-lg border">
      {/* Header */}
      <div
        className="bg-muted/30 border-border/50 hover:bg-muted/50 flex cursor-pointer items-center justify-between border-b px-3 py-1.5 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <ChevronIcon className="text-muted-foreground h-4 w-4" />
          <ListTodo className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">Todo</span>
          <span className="text-muted-foreground text-xs">
            ({completedCount}/{totalCount})
          </span>
        </div>
        {hasActiveItem && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
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
              ref={scrollContainerRef}
              className="divide-border/20 divide-y overflow-y-auto"
              style={{ maxHeight: MAX_HEIGHT }}
            >
              {todoItems.map((item) => (
                <TodoItemComponent
                  key={item.id}
                  item={item}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default TodoProgressList;
