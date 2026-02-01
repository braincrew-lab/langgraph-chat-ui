"use client";

import { motion, AnimatePresence } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { type HierarchicalTask, type IntermediateLLMOutput } from "@/types/task-hierarchy";
import type { TaskProgressItem } from "@/types/task-progress";
import { TodoProgressList } from "./streaming/TodoProgressList";
import { TaskProgressList } from "./streaming/TaskProgressList";
import { ActiveTasksList } from "./streaming/ActiveTask";
// import { IntermediateLLMOutputList } from "./streaming/IntermediateLLMOutputs"; // Disabled: Now integrated into TaskProgressList
import { cn } from "@/lib/utils";

interface StreamingTaskViewProps {
  progress: TaskProgressItem[];
  activeLeafTasks: HierarchicalTask[];
  isStreaming: boolean;
  className?: string;
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
  intermediateOutputs?: IntermediateLLMOutput[];
  finalNodeId?: string | null;
}

/**
 * StreamingTaskView - Streaming task progress display
 *
 * Shows task progress, active tasks, and a "thinking" indicator when streaming
 * but no content is available yet. This prevents flickering by always having
 * content to render during streaming.
 */
export function StreamingTaskView({
  progress,
  activeLeafTasks,
  isStreaming,
  className,
  selectedTaskId,
  onSelectTask,
  intermediateOutputs,
  finalNodeId,
}: StreamingTaskViewProps) {
  // Check for non-final intermediate outputs
  const hasIntermediateOutputs = intermediateOutputs && intermediateOutputs.filter(o => !o.isFinal).length > 0;

  // Check if there's any actual content to display
  const hasContent = progress.length > 0 || activeLeafTasks.length > 0 || hasIntermediateOutputs;

  // Show thinking state when streaming but no content yet
  const showThinkingState = isStreaming && !hasContent;

  // Don't render anything if not streaming and no content
  if (!isStreaming && !hasContent) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Thinking state - shown when streaming but no content yet */}
      {showThinkingState && (
        <motion.div
          key="thinking"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-2 text-sm text-muted-foreground py-2"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>Thinking...</span>
        </motion.div>
      )}

      {/* Todo progress list */}
      {progress.length > 0 && (
        <TodoProgressList
          items={progress}
          isStreaming={isStreaming}
        />
      )}

      {/* Task progress list (subagent tasks and running tools) */}
      {progress.length > 0 && (
        <TaskProgressList
          items={progress}
          isStreaming={isStreaming}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
        />
      )}

      {/* Active leaf tasks (when no progress items but tasks running) */}
      {progress.length === 0 && activeLeafTasks.length > 0 && (
        <ActiveTasksList tasks={activeLeafTasks} isStreaming={isStreaming} />
      )}
    </motion.div>
  );
}
