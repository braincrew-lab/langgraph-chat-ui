"use client";

/**
 * ToolCard Component
 *
 * Unified component for displaying tool calls and results.
 * Replaces: ToolCalls, ToolResult, ToolCallItem in HierarchicalTodoList
 *
 * Features:
 * - Single component for both call and result display
 * - Collapsible args/result sections
 * - Status indicator with latency badge
 * - JSON syntax highlighting for complex values
 * - Error state display
 * - Compact and full variants
 */

import { useState, useEffect, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/shared/hooks/useSettings";
import type { ToolStatus } from "@/types/task-progress";

// ============================================
// Types
// ============================================

interface ToolCardProps {
  /** Tool name */
  name: string;
  /** Tool arguments */
  args: Record<string, unknown>;
  /** Current status */
  status: ToolStatus;
  /** Tool result (if completed) */
  result?: string;
  /** Error message (if error) */
  error?: string;
  /** Latency in milliseconds from LangSmith */
  latency?: number;
  /** Tool call ID (for display) */
  toolCallId?: string;
  /** Display variant */
  variant?: "compact" | "full";
  /** Custom className */
  className?: string;
  /** Auto-collapse when completed */
  autoCollapse?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function isComplexValue(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

function formatLatency(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function truncateResult(result: string, maxLength: number = 500): { text: string; isTruncated: boolean } {
  if (result.length <= maxLength) {
    return { text: result, isTruncated: false };
  }
  return { text: result.slice(0, maxLength) + "...", isTruncated: true };
}

// ============================================
// Sub-components
// ============================================

const StatusIcon = memo(function StatusIcon({ status }: { status: ToolStatus }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
    default:
      return <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />;
  }
});

const LatencyBadge = memo(function LatencyBadge({ latency }: { latency: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted/70 px-2 py-0.5 text-xs font-mono text-muted-foreground border border-border/30">
      <Clock className="h-3 w-3" />
      {formatLatency(latency)}
    </span>
  );
});

// ============================================
// Args Table Component
// ============================================

const ArgsTable = memo(function ArgsTable({
  args,
  compact = false,
}: {
  args: Record<string, unknown>;
  compact?: boolean;
}) {
  const entries = Object.entries(args);

  if (entries.length === 0) {
    return (
      <div className="px-4 py-3">
        <span className="text-xs text-muted-foreground/60 italic">No arguments</span>
      </div>
    );
  }

  if (compact) {
    // Compact view: simple key=value list
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {entries.map(([key, value], idx) => (
          <span key={key}>
            <span className="font-medium text-foreground/70">{key}</span>
            <span className="text-muted-foreground">=</span>
            <span className="text-foreground/85">
              {isComplexValue(value) ? "[...]" : String(value).slice(0, 50)}
            </span>
            {idx < entries.length - 1 && ", "}
          </span>
        ))}
      </div>
    );
  }

  // Full view: table layout
  return (
    <table className="min-w-full">
      <tbody className="divide-y divide-border/40">
        {entries.map(([key, value]) => (
          <tr key={key} className="transition-colors duration-150 hover:bg-muted/30">
            <td className="px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-foreground/70 bg-muted/20 w-1/4">
              {key}
            </td>
            <td className="px-4 py-2.5 text-sm text-foreground/85">
              {isComplexValue(value) ? (
                <code className="block rounded-lg bg-muted/40 px-3 py-2 font-mono text-xs break-all border border-border/30 whitespace-pre-wrap">
                  {formatValue(value)}
                </code>
              ) : (
                <span className="font-normal break-words">{formatValue(value)}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});

// ============================================
// Result Display Component
// ============================================

const ResultDisplay = memo(function ResultDisplay({
  result,
  error,
  maxLines = 10,
}: {
  result?: string;
  error?: string;
  maxLines?: number;
}) {
  const [showFull, setShowFull] = useState(false);

  if (error) {
    return (
      <div className="px-4 py-3 bg-red-50/50 dark:bg-red-950/20 border-t border-red-200/50 dark:border-red-800/30">
        <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Error</div>
        <code className="text-xs text-red-600 dark:text-red-300 whitespace-pre-wrap break-words">
          {error}
        </code>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="px-4 py-3 border-t border-border/40">
        <span className="text-xs text-muted-foreground/60 italic">No result</span>
      </div>
    );
  }

  // Try to parse as JSON for better display
  let parsedContent: unknown = result;
  let isJsonContent = false;

  try {
    parsedContent = JSON.parse(result);
    isJsonContent = isComplexValue(parsedContent);
  } catch {
    // Not JSON, use as-is
  }

  const { text: displayText, isTruncated } = truncateResult(
    isJsonContent ? JSON.stringify(parsedContent, null, 2) : result,
    showFull ? Infinity : 500
  );
  const lines = displayText.split("\n");
  const shouldShowMore = isTruncated || lines.length > maxLines;

  return (
    <div className="border-t border-border/40">
      <div className="px-4 py-3">
        <div className="text-xs font-medium text-muted-foreground mb-2">Result</div>
        <code className="block rounded-lg bg-muted/40 px-3 py-2 text-xs font-mono border border-border/30 leading-relaxed whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">
          {showFull ? (isJsonContent ? JSON.stringify(parsedContent, null, 2) : result) : displayText}
        </code>
      </div>
      {shouldShowMore && (
        <button
          onClick={() => setShowFull(!showFull)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-muted-foreground border-t border-border/40 hover:bg-muted/30 transition-colors"
        >
          {showFull ? (
            <>
              <ChevronDown className="h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="h-3 w-3" />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
});

// ============================================
// Main ToolCard Component
// ============================================

export const ToolCard = memo(function ToolCard({
  name,
  args,
  status,
  result,
  error,
  latency,
  toolCallId,
  variant = "full",
  className,
  autoCollapse = true,
}: ToolCardProps) {
  const { userSettings } = useSettings();
  // Start collapsed by default (more compact), expand when user clicks
  const [isExpanded, setIsExpanded] = useState(false);

  // Auto-collapse when completed (if setting enabled)
  useEffect(() => {
    if (autoCollapse && userSettings.autoCollapseToolCalls && status === "completed") {
      setIsExpanded(false);
    }
  }, [status, autoCollapse, userSettings.autoCollapseToolCalls]);

  const hasArgs = Object.keys(args).length > 0;
  const hasResult = result && result.length > 0;
  const isCompact = variant === "compact";

  // Get status-specific styling
  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "border-green-300 dark:border-green-700/50 bg-green-50/30 dark:bg-green-950/10";
      case "error":
        return "border-red-300 dark:border-red-700/50 bg-red-50/30 dark:bg-red-950/10";
      case "running":
      default:
        return "border-purple-300 dark:border-purple-700/50 bg-purple-50/30 dark:bg-purple-950/10";
    }
  };

  // Compact variant: minimal inline display
  if (isCompact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 text-xs",
          "border-l-2 rounded-r",
          getStatusColor(),
          className
        )}
      >
        <Wrench className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-foreground/80">{name}</span>
        <StatusIcon status={status} />
        {latency && <LatencyBadge latency={latency} />}
        {hasArgs && (
          <span className="text-muted-foreground truncate max-w-[200px]">
            {Object.entries(args)
              .map(([k, v]) => `${k}=${isComplexValue(v) ? "[...]" : String(v).slice(0, 20)}`)
              .join(", ")}
          </span>
        )}
      </div>
    );
  }

  // Full variant: unified inline style with border-left (matches TaskProgressList)
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border-l-2",
        getStatusColor(),
        "transition-all duration-150",
        className
      )}
    >
      {/* Header - compact inline style */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">{name}</span>
            <StatusIcon status={status} />
            {latency && <LatencyBadge latency={latency} />}
            {/* Show args preview when collapsed */}
            {!isExpanded && hasArgs && (
              <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                ({Object.entries(args).map(([k, v]) =>
                  `${k}=${isComplexValue(v) ? "[...]" : String(v).slice(0, 15)}`
                ).join(", ")})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {toolCallId && (
              <code className="hidden sm:inline rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                {toolCallId.slice(0, 6)}
              </code>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
            >
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-border/30"
          >
            {/* Args Section */}
            {hasArgs && (
              <div className="bg-muted/10">
                <ArgsTable args={args} />
              </div>
            )}

            {/* Result Section */}
            {(hasResult || error || status === "completed") && (
              <ResultDisplay result={result} error={error} />
            )}

            {/* Running State */}
            {status === "running" && !hasResult && (
              <div className="px-3 py-2 bg-purple-50/20 dark:bg-purple-950/10">
                <div className="flex items-center gap-2 text-xs text-purple-600 dark:text-purple-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Running...</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// ToolCardList Component
// ============================================

interface ToolCardListProps {
  tools: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    status: ToolStatus;
    result?: string;
    error?: string;
    latency?: number;
    toolCallId?: string;
  }>;
  variant?: "compact" | "full";
  className?: string;
}

export const ToolCardList = memo(function ToolCardList({
  tools,
  variant = "full",
  className,
}: ToolCardListProps) {
  const { userSettings } = useSettings();

  if (tools.length === 0) return null;

  return (
    <div
      className={cn(
        "grid gap-3",
        userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl",
        "mx-auto",
        className
      )}
    >
      {tools.map((tool) => (
        <ToolCard
          key={tool.id}
          name={tool.name}
          args={tool.args}
          status={tool.status}
          result={tool.result}
          error={tool.error}
          latency={tool.latency}
          toolCallId={tool.toolCallId}
          variant={variant}
        />
      ))}
    </div>
  );
});

export default ToolCard;
