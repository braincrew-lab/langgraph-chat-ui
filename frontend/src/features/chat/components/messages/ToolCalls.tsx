import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Wrench, CheckCircle2 } from "lucide-react";
import { useSettings } from "@/shared/hooks/useSettings";
import { cn } from "@/lib/utils";

function isComplexValue(value: unknown): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

export function ToolCalls({
  toolCalls,
  isLoading,
}: {
  toolCalls: AIMessage["tool_calls"];
  isLoading?: boolean;
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="grid gap-4">
      {toolCalls.map((tc, idx) => {
        return (
          <ToolCallItem
            key={idx}
            toolCall={tc}
            isLoading={isLoading}
          />
        );
      })}
    </div>
  );
}

function ToolCallItem({
  toolCall,
  isLoading,
}: {
  toolCall: NonNullable<AIMessage["tool_calls"]>[number];
  isLoading?: boolean;
}) {
  const { userSettings } = useSettings();
  // Start collapsed by default for unified compact style
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (userSettings.autoCollapseToolCalls && isLoading === false) {
      setIsExpanded(false);
    }
  }, [isLoading, userSettings.autoCollapseToolCalls]);

  const args = toolCall.args as Record<string, unknown>;
  const hasArgs = Object.keys(args).length > 0;
  const argEntries = Object.entries(args);

  return (
    <div
      className={cn(
        "bg-card border-border w-full overflow-hidden rounded-xl border shadow-sm transition-all duration-150",
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-muted/50 w-full px-4 py-3 text-left transition-colors"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
              <Wrench className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-foreground truncate text-sm font-semibold">
              {toolCall.name}
            </span>
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
            {/* Show args preview when collapsed */}
            {!isExpanded && hasArgs && (
              <span className="text-muted-foreground hidden max-w-[200px] truncate text-xs sm:inline">
                (
                {argEntries
                  .map(
                    ([k, v]) =>
                      `${k}=${isComplexValue(v) ? "[...]" : String(v).slice(0, 15)}`,
                  )
                  .join(", ")}
                )
              </span>
            )}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {toolCall.id && (
              <code className="bg-muted text-muted-foreground/70 hidden rounded-md px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                {toolCall.id.slice(0, 6)}
              </code>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 0 : -90 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
            >
              <ChevronDown className="text-muted-foreground/60 h-4 w-4" />
            </motion.div>
          </div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="border-border/50 overflow-hidden border-t"
          >
            {hasArgs ? (
              <div className="bg-muted/10">
                <table className="min-w-full">
                  <tbody className="divide-border/40 divide-y">
                    {argEntries.map(([key, value], argIdx) => (
                      <tr
                        key={argIdx}
                        className="hover:bg-muted/30 transition-colors duration-150"
                      >
                        <td className="text-foreground/70 bg-muted/20 w-1/4 px-4 py-2.5 text-xs font-semibold whitespace-nowrap">
                          {key}
                        </td>
                        <td className="text-foreground/85 px-4 py-2.5 text-sm">
                          {isComplexValue(value) ? (
                            <code className="bg-muted/40 border-border/30 block rounded-lg border px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap">
                              {JSON.stringify(value, null, 2)}
                            </code>
                          ) : (
                            <span className="font-normal break-words">
                              {String(value)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-3">
                <span className="text-muted-foreground/60 text-xs italic">
                  No arguments
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ToolResult({
  message,
  isLoading,
}: {
  message: ToolMessage;
  isLoading?: boolean;
}) {
  const { userSettings } = useSettings();
  // Start collapsed by default for unified compact style
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  useEffect(() => {
    if (userSettings.autoCollapseToolCalls && isLoading === false) {
      setIsExpanded(false);
    }
  }, [isLoading, userSettings.autoCollapseToolCalls]);

  let parsedContent: unknown;
  let isJsonContent = false;

  try {
    if (typeof message.content === "string") {
      parsedContent = JSON.parse(message.content);
      isJsonContent = isComplexValue(parsedContent);
    }
  } catch {
    // Content is not JSON, use as is
    parsedContent = message.content;
  }

  const contentStr = isJsonContent
    ? JSON.stringify(parsedContent, null, 2)
    : String(message.content);
  const shouldTruncate = contentStr.length > 300;
  const displayedContent =
    shouldTruncate && !showFullContent
      ? contentStr.slice(0, 300) + "..."
      : contentStr;

  // Preview for collapsed state
  const previewContent = contentStr.slice(0, 60).replace(/\n/g, " ");

  return (
    <div className="grid gap-0">
      <div
        className={cn(
          "bg-card border-border w-full overflow-hidden rounded-xl border shadow-sm transition-all duration-150",
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="hover:bg-muted/50 w-full px-4 py-3 text-left transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/40">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <span className="text-foreground text-sm font-semibold">
                {message.name || "Result"}
              </span>
              {/* Preview when collapsed */}
              {!isExpanded && (
                <span className="text-muted-foreground hidden max-w-[200px] truncate text-xs sm:inline">
                  {previewContent}
                  {previewContent.length >= 60 ? "..." : ""}
                </span>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {message.tool_call_id && (
                <code className="bg-muted text-muted-foreground/70 hidden rounded-md px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                  {message.tool_call_id.slice(0, 6)}
                </code>
              )}
              <motion.div
                animate={{ rotate: isExpanded ? 0 : -90 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
              >
                <ChevronDown className="text-muted-foreground/60 h-4 w-4" />
              </motion.div>
            </div>
          </div>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              className="border-border/50 min-w-full overflow-hidden border-t"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="bg-muted/10 p-4">
                {isJsonContent ? (
                  <table className="min-w-full">
                    <tbody className="divide-border/40 divide-y">
                      {(Array.isArray(parsedContent)
                        ? showFullContent
                          ? parsedContent
                          : parsedContent.slice(0, 5)
                        : Object.entries(
                            parsedContent as Record<string, unknown>,
                          )
                      ).map((item, argIdx) => {
                        const [key, value] = Array.isArray(parsedContent)
                          ? [argIdx, item]
                          : [item[0], item[1]];
                        return (
                          <tr
                            key={argIdx}
                            className="hover:bg-muted/30 transition-colors duration-150"
                          >
                            <td className="text-foreground/70 bg-muted/20 w-1/4 px-4 py-2.5 text-xs font-semibold whitespace-nowrap">
                              {key}
                            </td>
                            <td className="text-foreground/85 px-4 py-2.5 text-sm">
                              {isComplexValue(value) ? (
                                <code className="bg-muted/40 border-border/30 block rounded-lg border px-3 py-2 font-mono text-xs break-all whitespace-pre-wrap">
                                  {JSON.stringify(value, null, 2)}
                                </code>
                              ) : (
                                <span className="font-normal break-words">
                                  {String(value)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <code className="bg-muted/40 border-border/30 block max-h-[200px] overflow-y-auto rounded-lg border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {displayedContent}
                  </code>
                )}
              </div>
              {((shouldTruncate && !isJsonContent) ||
                (isJsonContent &&
                  Array.isArray(parsedContent) &&
                  parsedContent.length > 5)) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullContent(!showFullContent);
                  }}
                  className="border-border/50 text-muted-foreground hover:bg-muted/30 flex w-full items-center justify-center gap-1.5 border-t py-2 text-xs font-medium transition-colors"
                >
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      showFullContent && "rotate-180",
                    )}
                  />
                  <span>{showFullContent ? "Show less" : "Show more"}</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
