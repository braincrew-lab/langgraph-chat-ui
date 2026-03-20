"use client";

/**
 * ActivityStream Component
 *
 * Unified activity stream that replaces TaskProgressList + IntermediateLLMOutputList.
 * Renders a single chronological list of ToolCallRow, SubgraphRow, and LLMOutputRow.
 */

import { useState, useMemo, memo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ActivityItem,
  ToolCallActivity,
  SubgraphActivity,
  LLMOutputActivity,
  LangSmithEnrichment,
  TaskChildNode,
} from "@/types/task-progress";

// ============================================
// Constants
// ============================================

const MAX_HEIGHT = 250;

// ============================================
// Types
// ============================================

interface ActivityStreamProps {
  items: ActivityItem[];
  isStreaming: boolean;
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
}

// ============================================
// Helper Components
// ============================================

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const StatusIcon = memo(function StatusIcon({
  status,
}: {
  status: "streaming" | "completed" | "error";
}) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />;
    case "streaming":
      return (
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
      );
    case "error":
      return <Circle className="h-4 w-4 flex-shrink-0 text-red-500" />;
  }
});

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
// ChildNodeItem (extracted from TaskProgressList)
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
  const hasScrolledRef = useRef(false);

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

    if (!hasScrolledRef.current) {
      const timeoutId = setTimeout(() => {
        scrollToBottom();
        hasScrolledRef.current = true;
      }, 200);
      return () => clearTimeout(timeoutId);
    }

    scrollToBottom();
  }, [isExpanded, node.isActive, node.content]);

  // Scroll into view when active
  useEffect(() => {
    if (!node.isActive || !itemRef.current || !scrollContainerRef?.current)
      return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef?.current;
      const item = itemRef.current;
      if (!container || !item) return;

      const containerRect = container.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      if (itemRect.bottom > containerRect.bottom) {
        container.scrollTop += itemRect.bottom - containerRect.bottom + 20;
      } else if (itemRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - itemRect.top + 20;
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [node.isActive, scrollContainerRef]);

  // Format toolArgs keys for display: "(key1, key2)"
  const toolArgsDisplay = node.toolArgs
    ? `(${Object.keys(node.toolArgs).join(", ")})`
    : "";

  return (
    <div
      ref={itemRef}
      className="border-border/50 ml-4 border-l-2"
      data-activity-item
      data-depth="1"
      data-kind="tool_call"
      data-status={node.isActive ? "streaming" : "completed"}
    >
      <div
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 text-xs",
          "bg-muted/20 rounded-r",
          canExpand && "hover:bg-muted/40 cursor-pointer",
        )}
        onClick={canExpand ? onToggle : undefined}
      >
        {canExpand ? (
          isExpanded ? (
            <ChevronDown className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          )
        ) : (
          <Circle className="text-muted-foreground/50 mt-0.5 h-3 w-3 flex-shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-foreground font-mono font-medium">
            {node.displayName}
          </span>
          {toolArgsDisplay && (
            <span className="text-muted-foreground/70 text-xs">
              {toolArgsDisplay}
            </span>
          )}
          {node.isActive ? (
            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
          ) : (
            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
          )}
        </div>

        {!isExpanded && hasContent && (
          <span className="text-muted-foreground max-w-[200px] truncate">
            {node.content.slice(0, 50)}...
          </span>
        )}
        {!isExpanded && node.isActive && !hasContent && (
          <span className="text-muted-foreground italic">Generating...</span>
        )}
      </div>

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
// ToolCallRow
// ============================================

const ToolCallRow = memo(function ToolCallRow({
  item,
}: {
  item: ToolCallActivity;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 text-sm"
      data-activity-item
      data-depth="0"
      data-kind="tool_call"
      data-status={item.status}
    >
      <div className="mt-0.5">
        <StatusIcon status={item.status} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{item.toolName}</span>
          {item.toolArgs && Object.keys(item.toolArgs).length > 0 && (
            <span className="text-muted-foreground/70 text-xs">
              ({Object.keys(item.toolArgs).join(", ")})
            </span>
          )}
          <span className="text-muted-foreground/40 text-[10px]">tool</span>
          {item.langsmith && <LangSmithBadge langsmith={item.langsmith} />}
        </div>
      </div>
    </div>
  );
});

// ============================================
// SubgraphRow
// ============================================

const SubgraphRow = memo(function SubgraphRow({
  item,
  scrollContainerRef,
}: {
  item: SubgraphActivity;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  // Default collapsed; user can expand manually
  const [isOpen, setIsOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

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

  // Auto-expand active child nodes
  useEffect(() => {
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
  }, [item.childNodes]);

  // Auto-scroll when in_progress
  useEffect(() => {
    if (
      item.status !== "streaming" ||
      !itemRef.current ||
      !scrollContainerRef?.current
    )
      return;

    const timer = setTimeout(() => {
      const container = scrollContainerRef?.current;
      const el = itemRef.current;
      if (!container || !el) return;

      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();

      if (elRect.bottom > containerRect.bottom) {
        container.scrollTop += elRect.bottom - containerRect.bottom + 20;
      } else if (elRect.top < containerRect.top) {
        container.scrollTop -= containerRect.top - elRect.top + 20;
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [item.status, scrollContainerRef]);

  const ChevronIcon = isOpen ? ChevronDown : ChevronRight;

  return (
    <div
      ref={itemRef}
      className="text-sm"
      data-activity-item
      data-depth="0"
      data-kind="subgraph"
      data-status={item.status}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5",
          "hover:bg-muted/30 cursor-pointer",
          "border-l-2",
          item.status === "streaming"
            ? "border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/20"
            : "border-l-green-500/50",
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronIcon className="text-muted-foreground h-4 w-4 flex-shrink-0" />
        <StatusIcon status={item.status} />
        <span
          className={cn(
            "font-medium",
            item.status === "streaming"
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          {item.displayName}
        </span>
        <span className="text-muted-foreground/40 text-[10px]">subgraph</span>
        {item.langsmith && <LangSmithBadge langsmith={item.langsmith} />}
        {/* Right side: running tool indicator (collapsed) or child count */}
        <div className="ml-auto flex items-center gap-2">
          {!isOpen && item.status === "streaming" && item.childNodes.length > 0 && (
            <span className="text-muted-foreground font-mono text-xs">
              {item.childNodes[item.childNodes.length - 1]?.displayName}
            </span>
          )}
          {!isOpen && item.childNodes.length > 0 && (
            <span className="text-muted-foreground/60 text-xs">
              {item.childNodes.length}
            </span>
          )}
        </div>
      </div>

      {/* Child nodes */}
      <AnimatePresence>
        {isOpen && item.childNodes.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pb-2"
          >
            {item.childNodes.map((childNode) => (
              <ChildNodeItem
                key={childNode.id}
                node={childNode}
                isExpanded={expandedNodes.has(childNode.id)}
                onToggle={() => toggleChildNode(childNode.id)}
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
// LLMOutputRow
// ============================================

const LLMOutputRow = memo(function LLMOutputRow({
  item,
}: {
  item: LLMOutputActivity;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isStreaming = item.status === "streaming";
  const hasOutput = item.fullOutput.length > 0;
  const canExpand = hasOutput || isStreaming;

  // Auto-scroll content when streaming
  useEffect(() => {
    if (isStreaming && isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [item.fullOutput, isStreaming, isOpen]);

  // Auto-expand when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  return (
    <div
      className="ml-2"
      data-activity-item
      data-depth="0"
      data-kind="llm_output"
      data-status={item.status}
    >
      <div
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 text-xs",
          "border-border border-l-2",
          "bg-muted/20 rounded-r",
          canExpand && "hover:bg-muted/40 cursor-pointer",
        )}
        onClick={canExpand ? () => setIsOpen(!isOpen) : undefined}
      >
        {canExpand ? (
          isOpen ? (
            <ChevronDown className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          )
        ) : (
          <Circle className="text-muted-foreground/50 mt-0.5 h-3 w-3 flex-shrink-0" />
        )}

        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-foreground font-medium">
            {item.displayName}
          </span>
          {isStreaming ? (
            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
          ) : (
            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
          )}
        </div>

        {!isOpen && hasOutput && (
          <span className="text-muted-foreground max-w-[300px] truncate">
            {item.outputSnippet}
          </span>
        )}
        {!isOpen && isStreaming && !hasOutput && (
          <span className="text-muted-foreground italic">Generating...</span>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="mt-1 mb-2 ml-5"
          >
            <div
              ref={contentRef}
              className="bg-muted/30 max-h-[300px] overflow-y-auto rounded p-2 text-xs"
            >
              <div className="text-foreground/80 break-words whitespace-pre-wrap">
                {item.fullOutput || (isStreaming ? "Generating..." : "")}
                {isStreaming && (
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
// Main ActivityStream Component
// ============================================

export const ActivityStream = memo(function ActivityStream({
  items,
  isStreaming,
}: ActivityStreamProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevItemsLengthRef = useRef(0);
  const isUserScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
    isUserScrolledRef.current = !atBottom;
  }, []);

  const hasStreamingItem = useMemo(
    () => items.some((i) => i.status === "streaming"),
    [items],
  );

  // Auto-expand when streaming is active
  useEffect(() => {
    if ((isStreaming || hasStreamingItem) && isCollapsed) {
      setIsCollapsed(false);
    }
  }, [isStreaming, hasStreamingItem, isCollapsed]);

  // Auto-scroll when new items appear
  const itemsLength = items.length;
  const streamingContentSignature = useMemo(
    () =>
      items
        .filter((i) => i.status === "streaming")
        .map((i) => {
          if (i.kind === "llm_output") return i.fullOutput.length;
          if (i.kind === "subgraph")
            return i.childNodes.map((c) => c.content.length).join(",");
          return 0;
        })
        .join("|"),
    [items],
  );

  useEffect(() => {
    if (isCollapsed || isUserScrolledRef.current) {
      prevItemsLengthRef.current = itemsLength;
      return;
    }

    const isNewItem = itemsLength > prevItemsLengthRef.current;
    const delay = isNewItem ? 250 : 0;

    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, delay);

    prevItemsLengthRef.current = itemsLength;
    return () => clearTimeout(timer);
  }, [itemsLength, streamingContentSignature, isCollapsed]);

  if (items.length === 0) {
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
          <Activity className="text-muted-foreground h-4 w-4" />
          <span className="text-sm font-medium">Activity</span>
          <span className="text-muted-foreground text-xs">
            ({items.length})
          </span>
        </div>
        {(isStreaming || hasStreamingItem) && (
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
              onScroll={handleScroll}
            >
              {items.map((item) => {
                switch (item.kind) {
                  case "tool_call":
                    return (
                      <ToolCallRow
                        key={item.id}
                        item={item}
                      />
                    );
                  case "subgraph":
                    return (
                      <SubgraphRow
                        key={item.id}
                        item={item}
                        scrollContainerRef={scrollContainerRef}
                      />
                    );
                  case "llm_output":
                    return (
                      <LLMOutputRow
                        key={item.id}
                        item={item}
                      />
                    );
                }
              })}
              {isStreaming && !hasStreamingItem && (
                <div className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
                  <span className="text-muted-foreground text-xs">
                    Thinking...
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default ActivityStream;
