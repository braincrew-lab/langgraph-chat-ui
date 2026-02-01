import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Wrench, CheckCircle2, Loader2 } from "lucide-react";
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
  const { userSettings } = useSettings();
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className={`mx-auto grid ${userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"} grid-rows-[1fr_auto] gap-4`}>
      {toolCalls.map((tc, idx) => {
        return <ToolCallItem key={idx} toolCall={tc} isLoading={isLoading} />;
      })}
    </div>
  );
}

function ToolCallItem({
  toolCall,
  isLoading
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
        "overflow-hidden rounded-lg border-l-2 transition-all duration-150",
        isLoading
          ? "border-purple-300 dark:border-purple-700/50 bg-purple-50/30 dark:bg-purple-950/10"
          : "border-green-300 dark:border-green-700/50 bg-green-50/30 dark:bg-green-950/10"
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">
              {toolCall.name}
            </span>
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 text-purple-500 animate-spin flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            )}
            {/* Show args preview when collapsed */}
            {!isExpanded && hasArgs && (
              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                ({argEntries.map(([k, v]) =>
                  `${k}=${isComplexValue(v) ? "[...]" : String(v).slice(0, 15)}`
                ).join(", ")})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {toolCall.id && (
              <code className="hidden sm:inline rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                {toolCall.id.slice(0, 6)}
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
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-border/30"
          >
            {hasArgs ? (
              <div className="bg-muted/10">
                <table className="min-w-full">
                  <tbody className="divide-y divide-border/40">
                    {argEntries.map(([key, value], argIdx) => (
                      <tr
                        key={argIdx}
                        className="transition-colors duration-150 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap text-foreground/70 bg-muted/20 w-1/4">
                          {key}
                        </td>
                        <td className="px-3 py-2 text-sm text-foreground/85">
                          {isComplexValue(value) ? (
                            <code className="block rounded bg-muted/40 px-2 py-1.5 font-mono text-xs break-all border border-border/30 whitespace-pre-wrap">
                              {JSON.stringify(value, null, 2)}
                            </code>
                          ) : (
                            <span className="font-normal break-words">{String(value)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-3 py-2">
                <span className="text-xs text-muted-foreground/60 italic">
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
  isLoading
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
  const displayedContent = shouldTruncate && !showFullContent
    ? contentStr.slice(0, 300) + "..."
    : contentStr;

  // Preview for collapsed state
  const previewContent = contentStr.slice(0, 60).replace(/\n/g, " ");

  return (
    <div className={`mx-auto grid ${userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"} grid-rows-[1fr_auto] gap-0`}>
      <div
        className={cn(
          "overflow-hidden rounded-lg border-l-2 transition-all duration-150",
          "border-green-300 dark:border-green-700/50 bg-green-50/30 dark:bg-green-950/10"
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-3 py-2 text-left transition-colors hover:bg-muted/30"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="font-medium text-sm text-foreground">
                {message.name || "Result"}
              </span>
              {/* Preview when collapsed */}
              {!isExpanded && (
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {previewContent}{previewContent.length >= 60 ? "..." : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {message.tool_call_id && (
                <code className="hidden sm:inline rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/70">
                  {message.tool_call_id.slice(0, 6)}
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
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              className="min-w-full overflow-hidden border-t border-border/30"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="p-3 bg-muted/10">
                {isJsonContent ? (
                  <table className="min-w-full">
                    <tbody className="divide-y divide-border/40">
                      {(Array.isArray(parsedContent)
                        ? showFullContent
                          ? parsedContent
                          : parsedContent.slice(0, 5)
                        : Object.entries(parsedContent as Record<string, unknown>)
                      ).map((item, argIdx) => {
                        const [key, value] = Array.isArray(parsedContent)
                          ? [argIdx, item]
                          : [item[0], item[1]];
                        return (
                          <tr
                            key={argIdx}
                            className="transition-colors duration-150 hover:bg-muted/30"
                          >
                            <td className="px-3 py-2 text-xs font-semibold whitespace-nowrap text-foreground/70 bg-muted/20 w-1/4">
                              {key}
                            </td>
                            <td className="px-3 py-2 text-sm text-foreground/85">
                              {isComplexValue(value) ? (
                                <code className="block rounded bg-muted/40 px-2 py-1.5 font-mono text-xs break-all border border-border/30 whitespace-pre-wrap">
                                  {JSON.stringify(value, null, 2)}
                                </code>
                              ) : (
                                <span className="font-normal break-words">{String(value)}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <code className="block rounded bg-muted/40 px-2 py-1.5 text-xs font-mono border border-border/30 leading-relaxed whitespace-pre-wrap max-h-[200px] overflow-y-auto">
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
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border/30 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  <ChevronDown className={cn("h-3 w-3 transition-transform", showFullContent && "rotate-180")} />
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
