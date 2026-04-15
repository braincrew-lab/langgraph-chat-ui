"use client";

import { useState, memo } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronDown, Activity } from "lucide-react";
import { useTaskProgress } from "@/features/chat/hooks/useTaskProgress";
import { StreamingTaskView } from "./StreamingTaskView";

interface CompletedTurnTaskViewProps {
  turnMessages: Message[];
  finalNodeNames: string[];
}

export const CompletedTurnTaskView = memo(function CompletedTurnTaskView({
  turnMessages,
  finalNodeNames,
}: CompletedTurnTaskViewProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const { progress, activityItems } = useTaskProgress({
    messages: turnMessages,
    isStreaming: false,
    finalNodeNames,
  });

  const hasContent = progress.length > 0 || activityItems.length > 0;
  if (!hasContent) return null;

  const todoCount = progress.filter((p) => p.source === "todo").length;
  const completedTodoCount = progress.filter(
    (p) => p.source === "todo" && p.status === "completed",
  ).length;

  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-lg border">
      <div
        className="bg-muted/30 border-border/50 hover:bg-muted/50 flex cursor-pointer items-center gap-2 border-b px-3 py-1.5 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <ChevronIcon className="text-muted-foreground h-4 w-4" />
        <Activity className="text-muted-foreground h-4 w-4" />
        <span className="text-sm font-medium">Turn Activity</span>
        {todoCount > 0 && (
          <span className="text-muted-foreground text-xs">
            ({completedTodoCount}/{todoCount})
          </span>
        )}
        {activityItems.length > 0 && (
          <span className="text-muted-foreground text-xs">
            {todoCount > 0 ? "· " : ""}
            {activityItems.length} activities
          </span>
        )}
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-2">
              <StreamingTaskView
                progress={progress}
                activeLeafTasks={[]}
                isStreaming={false}
                activityItems={activityItems}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
