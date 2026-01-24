"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  GitBranch,
  CheckCircle2,
  Loader2,
  XCircle,
  Bot,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type HierarchicalTask } from "@/types/task-hierarchy";

interface SubagentOutputProps {
  task: HierarchicalTask;
  isStreaming: boolean;
  defaultExpanded?: boolean;
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
      return <Loader2 className="h-4 w-4 text-muted-foreground/50" />;
  }
};

const TaskTypeIcon = ({ type }: { type: HierarchicalTask["type"] }) => {
  switch (type) {
    case "tool":
      return <Wrench className="h-3.5 w-3.5 text-orange-500" />;
    case "llm":
      return <Bot className="h-3.5 w-3.5 text-blue-500" />;
    case "agent":
      return <GitBranch className="h-3.5 w-3.5 text-purple-500" />;
    default:
      return <GitBranch className="h-3.5 w-3.5 text-gray-500" />;
  }
};

function SubagentChildTask({ task, depth = 0 }: { task: HierarchicalTask; depth?: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const hasChildren = task.children.length > 0;
  const hasContent = task.toolResult || task.toolArgs;

  return (
    <div className="border-l-2 border-border/50 ml-2 pl-3">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/30",
          task.status === "running" && "bg-blue-50/30 dark:bg-blue-950/20"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <StatusIcon status={task.status} />
        <TaskTypeIcon type={task.type} />
        <span className="text-sm font-medium truncate flex-1">{task.name}</span>
        {(hasChildren || hasContent) && (
          <motion.div
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.15 }}
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Tool Args */}
            {task.toolArgs && Object.keys(task.toolArgs).length > 0 && (
              <div className="ml-6 mt-1 mb-2">
                <div className="text-xs text-muted-foreground mb-1">Arguments:</div>
                <pre className="text-xs bg-muted/30 p-2 rounded overflow-x-auto max-h-20">
                  {JSON.stringify(task.toolArgs, null, 2).substring(0, 300)}
                  {JSON.stringify(task.toolArgs, null, 2).length > 300 && "..."}
                </pre>
              </div>
            )}

            {/* Tool Result */}
            {task.toolResult && (
              <div className="ml-6 mt-1 mb-2">
                <div className="text-xs text-muted-foreground mb-1">Result:</div>
                <pre className="text-xs bg-muted/30 p-2 rounded overflow-x-auto max-h-32 whitespace-pre-wrap">
                  {task.toolResult.substring(0, 500)}
                  {task.toolResult.length > 500 && "..."}
                </pre>
              </div>
            )}

            {/* Children */}
            {hasChildren && (
              <div className="mt-1">
                {task.children.map((child) => (
                  <SubagentChildTask key={child.id} task={child} depth={depth + 1} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SubagentOutput({ task, isStreaming, defaultExpanded = false }: SubagentOutputProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || task.status === "running");

  // 완료된 자식 수 계산
  const completedCount = task.children.filter(c => c.status === "completed").length;
  const totalCount = task.children.length;

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800/50 bg-purple-50/30 dark:bg-purple-950/10 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-colors"
      >
        <StatusIcon status={task.status} />
        <GitBranch className="h-4 w-4 text-purple-500" />
        <span className="font-medium text-sm flex-1 truncate">{task.name}</span>
        {totalCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        )}
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-purple-200/50 dark:border-purple-800/30"
          >
            <div className="p-2 max-h-80 overflow-y-auto">
              {task.children.length > 0 ? (
                task.children.map((child) => (
                  <SubagentChildTask key={child.id} task={child} depth={0} />
                ))
              ) : (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  {isStreaming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      실행 중...
                    </>
                  ) : (
                    "하위 태스크 없음"
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SubagentListProps {
  tasks: HierarchicalTask[];
  isStreaming: boolean;
}

export function SubagentList({ tasks, isStreaming }: SubagentListProps) {
  // 에이전트/체인 타입의 태스크만 필터링 (서브에이전트)
  const subagentTasks = tasks.filter(
    (t) => t.type === "agent" || (t.type === "chain" && t.children.length > 0)
  );

  if (subagentTasks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <GitBranch className="h-4 w-4" />
        <span>서브에이전트 ({subagentTasks.length})</span>
      </div>
      {subagentTasks.map((task) => (
        <SubagentOutput
          key={task.id}
          task={task}
          isStreaming={isStreaming}
          defaultExpanded={task.status === "running"}
        />
      ))}
    </div>
  );
}
