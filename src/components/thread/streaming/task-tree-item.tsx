"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  ChevronRight,
  Wrench,
  Bot,
  GitBranch,
  Box,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type HierarchicalTask } from "@/types/task-hierarchy";

interface TaskTreeItemProps {
  task: HierarchicalTask;
  isExpanded: boolean;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  depth?: number;
}

const StatusIcon = ({ status }: { status: HierarchicalTask["status"] }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "error":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "pending":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  }
};

const TaskTypeIcon = ({ type }: { type: HierarchicalTask["type"] }) => {
  const className = "h-3.5 w-3.5";
  switch (type) {
    case "tool":
      return <Wrench className={cn(className, "text-orange-500")} />;
    case "llm":
      return <Bot className={cn(className, "text-blue-500")} />;
    case "agent":
      return <GitBranch className={cn(className, "text-purple-500")} />;
    case "chain":
    default:
      return <Box className={cn(className, "text-gray-500")} />;
  }
};

const TypeBadge = ({ type }: { type: HierarchicalTask["type"] }) => {
  const styles: Record<HierarchicalTask["type"], string> = {
    tool: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    llm: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    agent: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    chain: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
  };

  const labels: Record<HierarchicalTask["type"], string> = {
    tool: "Tool",
    llm: "LLM",
    agent: "Agent",
    chain: "Chain",
  };

  return (
    <span
      className={cn(
        "px-1.5 py-0.5 text-[10px] font-medium rounded shrink-0",
        styles[type]
      )}
    >
      {labels[type]}
    </span>
  );
};

const formatLatency = (latency?: number) => {
  if (!latency) return null;
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

export function TaskTreeItem({
  task,
  isExpanded,
  expandedIds,
  onToggle,
  depth = 0,
}: TaskTreeItemProps) {
  const hasChildren = task.children.length > 0;
  const latencyStr = formatLatency(task.latency);
  const paddingLeft = depth * 16;

  return (
    <div className="select-none">
      {/* Task Row */}
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          task.status === "running" && "bg-blue-50/50 dark:bg-blue-950/20"
        )}
        style={{ paddingLeft: `${paddingLeft + 8}px` }}
        onClick={() => hasChildren && onToggle(task.id)}
      >
        {/* Expand/Collapse Arrow */}
        <div className="w-4 flex items-center justify-center flex-shrink-0">
          {hasChildren && (
            <motion.div
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.15 }}
            >
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          )}
        </div>

        {/* Status Icon */}
        <StatusIcon status={task.status} />

        {/* Type Icon */}
        <TaskTypeIcon type={task.type} />

        {/* Name */}
        <span className="text-sm font-medium truncate flex-1">{task.name}</span>

        {/* Type Badge */}
        <TypeBadge type={task.type} />

        {/* Latency */}
        {latencyStr && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {latencyStr}
          </span>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Vertical line connector */}
            <div
              className="relative"
              style={{ marginLeft: `${paddingLeft + 16}px` }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-px bg-border/50" />
              <div className="pl-4">
                {task.children.map((child) => (
                  <TaskTreeItem
                    key={child.id}
                    task={child}
                    isExpanded={expandedIds.has(child.id)}
                    expandedIds={expandedIds}
                    onToggle={onToggle}
                    depth={depth + 1}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TaskTreeViewProps {
  tasks: HierarchicalTask[];
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function TaskTreeView({ tasks, expandedIds, onToggle }: TaskTreeViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        태스크가 없습니다
      </div>
    );
  }

  return (
    <div className="py-2">
      {tasks.map((task) => (
        <TaskTreeItem
          key={task.id}
          task={task}
          isExpanded={expandedIds.has(task.id)}
          expandedIds={expandedIds}
          onToggle={onToggle}
          depth={0}
        />
      ))}
    </div>
  );
}
