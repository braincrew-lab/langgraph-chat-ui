"use client";

import { motion } from "framer-motion";
import { type HierarchicalTask, type IntermediateLLMOutput } from "@/types/task-hierarchy";
import { type HierarchicalTodoItem } from "@/types/task-hierarchy";
import { HierarchicalTodoList } from "./streaming/HierarchicalTodoList";
import { ActiveTasksList } from "./streaming/ActiveTask";
import { IntermediateLLMOutputList } from "./streaming/IntermediateLLMOutputs";
import { cn } from "@/lib/utils";

interface StreamingTaskViewProps {
  hierarchicalTodos: HierarchicalTodoItem[];
  activeLeafTasks: HierarchicalTask[];
  isStreaming: boolean;
  className?: string;
  // TODO ↔ 사이드바 연동
  selectedTaskId?: string | null;
  onSelectTask?: (taskId: string | null) => void;
  // 중간 노드 출력 (컴팩트 표시)
  intermediateOutputs?: IntermediateLLMOutput[];
  finalNodeId?: string | null;
}

/**
 * StreamingTaskView - 스트리밍 중 태스크 진행 상황 표시
 *
 * 주의: 이 컴포넌트는 부모에서 hasVisibleContent 조건을 확인한 후에만 렌더링되어야 합니다.
 * 컨텐츠가 없을 때 이 컴포넌트를 렌더링하면 빈 gap이 발생할 수 있습니다.
 */
export function StreamingTaskView({
  hierarchicalTodos,
  activeLeafTasks,
  isStreaming,
  className,
  selectedTaskId,
  onSelectTask,
  intermediateOutputs,
  finalNodeId,
}: StreamingTaskViewProps) {
  // 중간 출력이 있는지 확인 (최종 노드가 아닌 출력만)
  const hasIntermediateOutputs = intermediateOutputs && intermediateOutputs.filter(o => !o.isFinal).length > 0;

  // 컨텐츠가 없으면 렌더링하지 않음 (이중 체크 - 부모에서도 체크해야 함)
  if (hierarchicalTodos.length === 0 && activeLeafTasks.length === 0 && !hasIntermediateOutputs) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex flex-col gap-3", className)}
    >
      {/* 중간 출력 컴팩트 리스트 (NEW) */}
      {hasIntermediateOutputs && (
        <IntermediateLLMOutputList outputs={intermediateOutputs} />
      )}

      {/* 계층적 Todo 리스트 (TODO + 서브에이전트 + 도구 통합) */}
      {hierarchicalTodos.length > 0 && (
        <HierarchicalTodoList
          items={hierarchicalTodos}
          isStreaming={isStreaming}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
        />
      )}

      {/* 현재 실행 중인 태스크 (TODO 없이 태스크만 있을 때 표시) */}
      {hierarchicalTodos.length === 0 && activeLeafTasks.length > 0 && (
        <ActiveTasksList tasks={activeLeafTasks} isStreaming={isStreaming} />
      )}
    </motion.div>
  );
}
