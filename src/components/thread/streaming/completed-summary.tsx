"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ChevronDown, Wrench, Bot, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { type HierarchicalTask, type TaskStats } from "@/types/task-hierarchy";

interface CompletedSummaryProps {
  tasks: HierarchicalTask[];
  stats: TaskStats;
  isExpanded: boolean;
  onToggle: () => void;
}

const formatLatency = (latency?: number) => {
  if (!latency) return null;
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

function CompletedTaskItem({ task }: { task: HierarchicalTask }) {
  const latencyStr = formatLatency(task.latency);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/30 transition-colors">
      {task.status === "completed" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
      )}
      {task.type === "tool" ? (
        <Wrench className="h-3 w-3 text-orange-500 flex-shrink-0" />
      ) : task.type === "llm" ? (
        <Bot className="h-3 w-3 text-blue-500 flex-shrink-0" />
      ) : null}
      <span className="font-mono text-xs truncate flex-1">{task.name}</span>
      {latencyStr && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {latencyStr}
        </span>
      )}
    </div>
  );
}

export function CompletedSummary({ tasks, stats, isExpanded, onToggle }: CompletedSummaryProps) {
  // 완료된 태스크만 표시 (tool과 llm 타입만)
  const displayTasks = tasks.filter(t => t.type === "tool" || t.type === "llm");

  if (displayTasks.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm font-medium">완료됨</span>
          <span className="text-xs text-muted-foreground">({displayTasks.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {stats.toolCount > 0 && (
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3 text-orange-500" />
                {stats.toolCount}
              </span>
            )}
            {stats.llmCount > 0 && (
              <span className="flex items-center gap-1">
                <Bot className="h-3 w-3 text-blue-500" />
                {stats.llmCount}
              </span>
            )}
            {stats.error > 0 && (
              <span className="flex items-center gap-1 text-red-500">
                <XCircle className="h-3 w-3" />
                {stats.error}
              </span>
            )}
          </div>
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "divide-y divide-border/30 max-h-60 overflow-y-auto",
              "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent"
            )}>
              {displayTasks.map((task, index) => (
                <CompletedTaskItem key={`${task.id || "task"}-${index}`} task={task} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
