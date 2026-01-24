"use client";

import { motion } from "framer-motion";
import { Loader2, Wrench, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { type CurrentToolCall } from "@/hooks/useStreamingView";

interface CurrentToolCallsProps {
  toolCalls: CurrentToolCall[];
  isStreaming: boolean;
}

function formatToolArgs(args: Record<string, unknown>): string {
  if (!args || Object.keys(args).length === 0) {
    return "";
  }

  // 주요 인자만 간략하게 표시
  const entries = Object.entries(args);
  const preview = entries.slice(0, 2).map(([key, value]) => {
    let displayValue = String(value);
    if (displayValue.length > 50) {
      displayValue = displayValue.substring(0, 50) + "...";
    }
    return `${key}: ${displayValue}`;
  });

  if (entries.length > 2) {
    preview.push(`+${entries.length - 2} more`);
  }

  return preview.join(", ");
}

export function CurrentToolCalls({ toolCalls, isStreaming }: CurrentToolCallsProps) {
  if (!isStreaming || toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Wrench className="h-3.5 w-3.5" />
        <span>도구 호출 중</span>
      </div>
      <div className="flex flex-col gap-1">
        {toolCalls.map((toolCall, index) => (
          <motion.div
            key={toolCall.id || `tool-${index}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={cn(
              "flex items-start gap-2 px-3 py-2 rounded-lg text-sm",
              "bg-orange-50/50 dark:bg-orange-950/20",
              "border border-orange-200/50 dark:border-orange-800/30"
            )}
          >
            {toolCall.status === "running" ? (
              <Loader2 className="h-4 w-4 text-orange-500 animate-spin flex-shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-medium text-orange-700 dark:text-orange-400">
                {toolCall.name}
              </span>
              {Object.keys(toolCall.args).length > 0 && (
                <span className="text-xs text-muted-foreground truncate">
                  {formatToolArgs(toolCall.args)}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
