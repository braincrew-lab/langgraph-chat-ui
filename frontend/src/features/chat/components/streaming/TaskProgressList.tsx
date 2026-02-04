"use client";

/**
 * TaskProgressList Component
 *
 * Displays Task items (source: "task" | "tool") from Task tool calls.
 * Separated from TodoProgressList for cleaner architecture.
 *
 * Key features:
 * - Groups by nodeName (subagent groups are collapsible)
 * - Shows running tools with args
 * - LangSmith enrichment display
 */

import { useState, useMemo, memo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  TaskProgressItem,
  LangSmithEnrichment,
  TaskChildNode,
} from "@/types/task-progress";

// ============================================
// Constants
// ============================================

const MAX_HEIGHT = 300;

// ============================================
// Types
// ============================================

interface TaskProgressListProps {
  items: TaskProgressItem[];
  isStreaming: boolean;
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
}

interface TaskGroupProps {
  name?: string;
  items: TaskProgressItem[];
  isStreaming: boolean;
  collapsible?: boolean;
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

interface TaskItemProps {
  item: TaskProgressItem;
  isStreaming: boolean;
  selected?: boolean;
  onSelect?: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

// ============================================
// Helper Functions
// ============================================

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function groupItems(
  items: TaskProgressItem[],
): Map<string, TaskProgressItem[]> {
  const groups = new Map<string, TaskProgressItem[]>();

  for (const item of items) {
    const groupName = item.group;
    const existing = groups.get(groupName) || [];
    existing.push(item);
    groups.set(groupName, existing);
  }

  return groups;
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
// LangSmith Info Badge
// ============================================

const LangSmithBadge = memo(function LangSmithBadge({
  langsmith,
}: {
  langsmith: LangSmithEnrichment;
}) {
  const parts: string[] = [];

  if (langsmith.latency) {
    parts.push(formatLatency(langsmith.latency));
  }

  if (langsmith.tokenUsage) {
    const total = langsmith.tokenUsage.input + langsmith.tokenUsage.output;
    parts.push(`${total} tok`);
  }

  if (langsmith.model) {
    parts.push(langsmith.model.split("/").pop() || langsmith.model);
  }

  if (parts.length === 0) return null;

  return (
    <span className="text-muted-foreground text-[10px]">
      {parts.join(" · ")}
    </span>
  );
});

// ============================================
// Child Node Component (for LLM outputs)
// ============================================

interface ChildNodeItemProps {
  node: TaskChildNode;
  isExpanded: boolean;
  onToggle: () => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

const ChildNodeItem = memo(function ChildNodeItem({
  node,
  isExpanded,
  onToggle,
  scrollContainerRef,
}: ChildNodeItemProps) {
  const hasContent = node.content.length > 0;
  const canExpand = hasContent || node.isActive;
  const contentRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  // Track if we've scrolled after initial expansion
  const hasScrolledRef = useRef(false);

  // Reset scroll flag when collapsed
  useEffect(() => {
    if (!isExpanded) {
      hasScrolledRef.current = false;
    }
  }, [isExpanded]);

  // Auto-scroll content to bottom when streaming
  useEffect(() => {
    if (!isExpanded || !node.isActive) return;

    const scrollToBottom = () => {
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight;
      }
    };

    // First time after expansion: wait for animation
    if (!hasScrolledRef.current) {
      const timeoutId = setTimeout(() => {
        scrollToBottom();
        hasScrolledRef.current = true;
      }, 200);
      return () => clearTimeout(timeoutId);
    }

    // Subsequent content updates: scroll immediately
    scrollToBottom();
  }, [isExpanded, node.isActive, node.content]);

  // Scroll this item into view when it becomes active
  useEffect(() => {
    if (node.isActive && itemRef.current && scrollContainerRef?.current) {
      // Calculate position within scroll container
      const container = scrollContainerRef.current;
      const item = itemRef.current;
      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      // Check if item is below visible area
      if (itemRect.bottom > containerRect.bottom) {
        container.scrollTop += itemRect.bottom - containerRect.bottom + 20;
      }
      // Check if item is above visible area
      else if (itemRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - itemRect.top + 20;
      }
    }
  }, [node.isActive, scrollContainerRef]);

  return (
    <div
      ref={itemRef}
      className="border-border/50 ml-4 border-l-2"
    >
      <div
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 text-xs",
          "bg-muted/20 rounded-r",
          canExpand && "hover:bg-muted/40 cursor-pointer",
        )}
        onClick={canExpand ? onToggle : undefined}
      >
        {/* Expand/Collapse Icon */}
        {canExpand ? (
          isExpanded ? (
            <ChevronDown className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          )
        ) : (
          <Circle className="text-muted-foreground/50 mt-0.5 h-3 w-3 flex-shrink-0" />
        )}

        {/* Node name and status */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-foreground font-medium">
            {node.displayName}
          </span>
          {node.isActive ? (
            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
          ) : (
            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
          )}
        </div>

        {/* Preview when collapsed */}
        {!isExpanded && hasContent && (
          <span className="text-muted-foreground max-w-[200px] truncate">
            {node.content.slice(0, 50)}...
          </span>
        )}
        {!isExpanded && node.isActive && !hasContent && (
          <span className="text-muted-foreground italic">Generating...</span>
        )}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && hasContent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-1 mb-2 ml-5"
          >
            <div
              ref={contentRef}
              className="bg-muted/30 max-h-[200px] overflow-y-auto rounded p-2 text-xs"
            >
              <div className="text-foreground/80 break-words whitespace-pre-wrap">
                {node.content}
                {node.isActive && (
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-blue-500 align-middle" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// Single Task Item Component
// ============================================

const TaskItemComponent = memo(function TaskItemComponent({
  item,
  isStreaming,
  selected,
  onSelect,
  scrollContainerRef,
}: TaskItemProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const taskItemRef = useRef<HTMLDivElement>(null);
  const hasLangsmith = !!item.langsmith;
  const hasChildNodes = item.childNodes && item.childNodes.length > 0;
  const isClickable = hasLangsmith && onSelect;

  const handleClick = useCallback(() => {
    if (isClickable) {
      onSelect?.();
    }
  }, [isClickable, onSelect]);

  const toggleChildNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Auto-expand active nodes
  useEffect(() => {
    if (item.childNodes) {
      const activeNodeIds = item.childNodes
        .filter((n) => n.isActive)
        .map((n) => n.id);
      if (activeNodeIds.length > 0) {
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          activeNodeIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  }, [item.childNodes]);

  // Auto-scroll to this task when it becomes in_progress
  useEffect(() => {
    if (
      item.status === "in_progress" &&
      taskItemRef.current &&
      scrollContainerRef?.current
    ) {
      const container = scrollContainerRef.current;
      const task = taskItemRef.current;
      const containerRect = container.getBoundingClientRect();
      const taskRect = task.getBoundingClientRect();

      if (taskRect.bottom > containerRect.bottom) {
        container.scrollTop += taskRect.bottom - containerRect.bottom + 20;
      } else if (taskRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - taskRect.top + 20;
      }
    }
  }, [item.status, scrollContainerRef]);

  return (
    <div
      ref={taskItemRef}
      className={cn(
        "text-sm",
        "transition-colors duration-150",
        item.status === "completed" && "text-muted-foreground",
        item.status === "in_progress" &&
          "bg-purple-50/50 dark:bg-purple-950/20",
        selected &&
          "bg-purple-100/50 ring-2 ring-purple-400 ring-inset dark:bg-purple-900/30",
      )}
    >
      {/* Main task header */}
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2",
          isClickable && "hover:bg-muted/30 cursor-pointer",
        )}
        onClick={handleClick}
      >
        {/* Status Icon */}
        <div className="mt-0.5">
          <StatusIcon status={item.status} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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

            {/* LangSmith info */}
            {item.langsmith && <LangSmithBadge langsmith={item.langsmith} />}
          </div>

          {/* Tool info for running tools */}
          {item.source === "tool" && item.status === "in_progress" && (
            <div className="text-muted-foreground mt-1 text-xs">
              <span className="font-mono">{item.toolName}</span>
              {item.toolArgs && Object.keys(item.toolArgs).length > 0 && (
                <span className="text-muted-foreground/70 ml-1">
                  ({Object.keys(item.toolArgs).join(", ")})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Child nodes with LLM outputs */}
      {hasChildNodes && (
        <div className="pb-2">
          {item.childNodes!.map((childNode) => (
            <ChildNodeItem
              key={childNode.id}
              node={childNode}
              isExpanded={expandedNodes.has(childNode.id)}
              onToggle={() => toggleChildNode(childNode.id)}
              scrollContainerRef={scrollContainerRef}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================
// Task Group Component
// ============================================

const TaskGroup = memo(function TaskGroup({
  name,
  items,
  isStreaming,
  collapsible = false,
  selectedTaskId,
  onSelectTask,
  scrollContainerRef,
}: TaskGroupProps) {
  const [expanded, setExpanded] = useState(true);

  const completedCount = items.filter((i) => i.status === "completed").length;
  const hasActiveItem = items.some((i) => i.status === "in_progress");

  const ChevronIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div className="task-group">
      {/* Group Header (only for collapsible groups) */}
      {collapsible && name && (
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-sm",
            "hover:bg-muted/30 transition-colors",
            "border-border/30 border-b",
          )}
        >
          <ChevronIcon className="text-muted-foreground h-4 w-4" />
          <span className="text-foreground/80 font-medium">{name}</span>
          <span className="text-muted-foreground ml-auto text-xs">
            {completedCount}/{items.length}
          </span>
          {hasActiveItem && (
            <Loader2 className="h-3 w-3 animate-spin text-purple-500" />
          )}
        </button>
      )}

      {/* Group Items */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="divide-border/20 divide-y"
          >
            {items.map((item) => (
              <TaskItemComponent
                key={item.id}
                item={item}
                isStreaming={isStreaming}
                selected={selectedTaskId === item.langsmith?.runId}
                onSelect={
                  item.langsmith?.runId
                    ? () =>
                        onSelectTask?.(
                          selectedTaskId === item.langsmith?.runId
                            ? null
                            : (item.langsmith?.runId ?? null),
                        )
                    : undefined
                }
                scrollContainerRef={scrollContainerRef}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// Main TaskProgressList Component
// ============================================

export const TaskProgressList = memo(function TaskProgressList({
  items,
  isStreaming,
  selectedTaskId,
  onSelectTask,
}: TaskProgressListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Filter only task and tool items (exclude todo)
  const taskItems = useMemo(
    () =>
      items.filter((item) => item.source === "task" || item.source === "tool"),
    [items],
  );

  // Find active item for auto-scroll
  const activeItemId = useMemo(() => {
    const activeItem = taskItems.find((i) => i.status === "in_progress");
    return activeItem?.id;
  }, [taskItems]);

  // Auto-expand when there's an active item
  useEffect(() => {
    if (activeItemId && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [activeItemId, isCollapsed]);

  // Group items by their group property
  const groups = useMemo(() => groupItems(taskItems), [taskItems]);

  // Get main group and subagent groups
  const mainItems = groups.get("main") || [];
  const subagentGroups = Array.from(groups.entries()).filter(
    ([name]) => name !== "main",
  );

  // Calculate totals
  const { completedCount, totalCount } = useMemo(
    () => ({
      completedCount: taskItems.filter((i) => i.status === "completed").length,
      totalCount: taskItems.length,
    }),
    [taskItems],
  );

  const hasActiveItem = taskItems.some((i) => i.status === "in_progress");

  if (taskItems.length === 0) {
    return null;
  }

  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-lg border">
      {/* Header */}
      <div
        className="bg-muted/30 border-border/50 hover:bg-muted/50 flex cursor-pointer items-center justify-between border-b px-3 py-2 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <ChevronIcon className="text-muted-foreground h-4 w-4" />
          <Layers className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">Tasks</span>
          <span className="text-muted-foreground text-xs">
            ({completedCount}/{totalCount})
          </span>
        </div>
        {hasActiveItem && (
          <span className="flex items-center gap-1 text-xs text-purple-500">
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
              className="overflow-y-auto"
              style={{ maxHeight: MAX_HEIGHT }}
            >
              {/* Main agent items */}
              {mainItems.length > 0 && (
                <TaskGroup
                  items={mainItems}
                  isStreaming={isStreaming}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                  scrollContainerRef={scrollContainerRef}
                />
              )}

              {/* Subagent groups (collapsible) */}
              {subagentGroups.map(([name, groupItems]) => (
                <TaskGroup
                  key={name}
                  name={name}
                  items={groupItems}
                  isStreaming={isStreaming}
                  collapsible
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                  scrollContainerRef={scrollContainerRef}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default TaskProgressList;
