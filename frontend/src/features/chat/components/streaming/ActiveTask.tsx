"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ChevronDown,
  Wrench,
  Bot,
  GitBranch,
  Box,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatValue } from "@/lib/utils/format";
import { type HierarchicalTask } from "@/types/task-hierarchy";
import { useTranslations } from "next-intl";

interface ActiveTaskProps {
  task: HierarchicalTask;
  depth?: number;
  showArgs?: boolean;
}

const TaskTypeIcon = ({ type }: { type: HierarchicalTask["type"] }) => {
  switch (type) {
    case "tool":
      return <Wrench className="h-3.5 w-3.5 text-orange-500" />;
    case "llm":
      return <Bot className="h-3.5 w-3.5 text-blue-500" />;
    case "agent":
      return <GitBranch className="h-3.5 w-3.5 text-purple-500" />;
    case "chain":
    default:
      return <Box className="h-3.5 w-3.5 text-gray-500" />;
  }
};

export function ActiveTask({
  task,
  depth = 0,
  showArgs = true,
}: ActiveTaskProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasArgs = task.toolArgs && Object.keys(task.toolArgs).length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20",
        depth > 0 && "mt-2 ml-4",
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-blue-500" />
        <TaskTypeIcon type={task.type} />
        <span className="flex-1 truncate text-sm font-medium">{task.name}</span>
        {hasArgs && showArgs && (
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="text-muted-foreground h-4 w-4" />
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && hasArgs && showArgs && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pt-0 pb-2">
              <div className="bg-muted/50 max-h-24 overflow-x-auto overflow-y-auto rounded-md p-2 font-mono text-xs">
                {Object.entries(task.toolArgs!).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex gap-2"
                  >
                    <span className="text-muted-foreground flex-shrink-0">
                      {key}:
                    </span>
                    <span className="text-foreground/80 truncate">
                      {formatValue(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface ActiveTasksListProps {
  tasks: HierarchicalTask[];
  isStreaming: boolean;
}

export function ActiveTasksList({ tasks, isStreaming }: ActiveTasksListProps) {
  const t = useTranslations("chat");

  if (tasks.length === 0 && !isStreaming) {
    return null;
  }

  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-lg border">
      <div className="bg-muted/30 border-border/50 flex items-center gap-2 border-b px-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm font-medium">{t("activeTask.running")}</span>
        {tasks.length > 0 && (
          <span className="text-muted-foreground text-xs">
            ({tasks.length})
          </span>
        )}
      </div>
      <div className="p-2">
        <AnimatePresence mode="popLayout">
          {tasks.length > 0 ? (
            tasks.map((task, index) => (
              <ActiveTask
                key={`${task.id || "task"}-${index}`}
                task={task}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground flex items-center justify-center py-4 text-sm"
            >
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("activeTask.waiting")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
