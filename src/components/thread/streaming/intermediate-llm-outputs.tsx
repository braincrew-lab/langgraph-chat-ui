"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type IntermediateLLMOutput } from "@/types/task-hierarchy";

interface IntermediateLLMOutputItemProps {
  output: IntermediateLLMOutput;
}

// 중간 노드 LLM 출력 아이템 (컴팩트 표시)
function IntermediateLLMOutputItem({ output }: IntermediateLLMOutputItemProps) {
  const isStreaming = output.status === "streaming";
  const hasOutput = output.fullOutput.length > 0;

  // 스트리밍 중에는 자동 펼침, 완료 후에는 수동 토글 가능
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const isExpanded = manualOverride !== null ? manualOverride : isStreaming;

  // 스트리밍 상태가 변경되면 수동 오버라이드 초기화
  useEffect(() => {
    if (isStreaming) {
      setManualOverride(null); // 스트리밍 시작하면 자동 펼침 모드로
    }
  }, [isStreaming]);

  // 스트리밍 중 자동 스크롤을 위한 ref
  const contentRef = useRef<HTMLDivElement>(null);

  // 출력 내용 변경 시 자동 스크롤
  useEffect(() => {
    if (isStreaming && isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [output.fullOutput, isStreaming, isExpanded]);

  const handleToggle = () => {
    if (hasOutput || isStreaming) {
      setManualOverride(prev => prev === null ? !isStreaming : !prev);
    }
  };

  // 최종 노드는 별도 처리 (여기서는 렌더링하지 않음)
  if (output.isFinal) return null;

  // 펼칠 수 있는 상태인지 (출력이 있거나 스트리밍 중)
  const canExpand = hasOutput || isStreaming;

  return (
    <div className="ml-2">
      <div
        className={cn(
          "flex items-start gap-2 py-1.5 px-2 text-xs",
          "border-l-2 border-border",
          "bg-muted/20 rounded-r",
          canExpand && "cursor-pointer hover:bg-muted/40"
        )}
        onClick={handleToggle}
      >
        {/* 확장/축소 아이콘 */}
        {canExpand ? (
          isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
          )
        ) : (
          <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
        )}

        {/* 노드 이름 및 상태 */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-foreground">
            {output.nodeName}
          </span>
          {isStreaming ? (
            <Loader2 className="h-3 w-3 text-blue-500 animate-spin flex-shrink-0" />
          ) : (
            <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
          )}
        </div>

        {/* 미리보기 (접힌 상태일 때) */}
        {!isExpanded && hasOutput && (
          <span className="text-muted-foreground truncate max-w-[300px]">
            {output.outputSnippet}
          </span>
        )}
        {/* 스트리밍 중이고 접힌 상태면 "Generating..." 표시 */}
        {!isExpanded && isStreaming && !hasOutput && (
          <span className="text-muted-foreground italic">Generating...</span>
        )}
      </div>

      {/* 펼친 상태: 전체 출력 (높이 제한 + 스크롤) */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="ml-5 mt-1 mb-2"
          >
            <div
              ref={contentRef}
              className="text-xs bg-muted/30 rounded p-2 max-h-[200px] overflow-y-auto"
            >
              <div className="whitespace-pre-wrap break-words text-foreground/80">
                {output.fullOutput || (isStreaming ? "Generating..." : "")}
                {/* 스트리밍 중이면 커서 표시 */}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-middle" />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface IntermediateLLMOutputListProps {
  outputs: IntermediateLLMOutput[];
}

// 중간 노드 LLM 출력 리스트 (컴팩트 표시)
// memo 제거 - 스트리밍 중 실시간 업데이트를 위해
export function IntermediateLLMOutputList({
  outputs,
}: IntermediateLLMOutputListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 최종 노드가 아닌 출력만 필터링
  const intermediateOutputs = outputs.filter(o => !o.isFinal);

  if (intermediateOutputs.length === 0) return null;

  const SectionChevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      {/* 헤더 */}
      <div
        className="px-3 py-2 bg-muted/30 border-b border-border/50 flex items-center gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <SectionChevron className="h-4 w-4 text-muted-foreground" />
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          Intermediate outputs
        </span>
        <span className="text-xs text-muted-foreground">
          ({intermediateOutputs.length})
        </span>
      </div>

      {/* 중간 출력 목록 (높이 제한 + 스크롤) */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="py-1 max-h-[400px] overflow-y-auto"
          >
            {intermediateOutputs.map((output, idx) => (
              <IntermediateLLMOutputItem key={`${output.nodeId}-${idx}`} output={output} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
