"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

/**
 * 노드명을 사용자 친화적인 텍스트로 변환
 * - snake_case → "Snake Case"
 * - camelCase → "Camel Case"
 * - 특수 키워드 처리 (llm → "LLM", api → "API" 등)
 */
function humanizeNodeName(nodeName: string): string {
  // 1. snake_case와 camelCase를 공백으로 분리
  const words = nodeName
    .replace(/_/g, " ") // snake_case → spaces
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length > 0);

  // 2. 각 단어 처리
  const processed = words.map((word) => {
    // 특수 약어는 대문자로
    const acronyms: Record<string, string> = {
      llm: "LLM",
      api: "API",
      ai: "AI",
      id: "ID",
      url: "URL",
      ui: "UI",
      ux: "UX",
    };
    if (acronyms[word]) return acronyms[word];

    // 일반 단어는 첫 글자만 대문자
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  return processed.join(" ");
}

interface IntermediateLLMOutputItemProps {
  output: IntermediateLLMOutput;
  isExpanded: boolean;
  onToggle: () => void;
}

// 중간 노드 LLM 출력 아이템 (컴팩트 표시)
function IntermediateLLMOutputItem({
  output,
  isExpanded,
  onToggle,
}: IntermediateLLMOutputItemProps) {
  const isStreaming = output.status === "streaming";
  const hasOutput = output.fullOutput.length > 0;

  // 스트리밍 중 자동 스크롤을 위한 ref
  const contentRef = useRef<HTMLDivElement>(null);

  // 출력 내용 변경 시 자동 스크롤
  useEffect(() => {
    if (isStreaming && isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [output.fullOutput, isStreaming, isExpanded]);

  // 최종 노드는 별도 처리 (여기서는 렌더링하지 않음)
  if (output.isFinal) return null;

  // 펼칠 수 있는 상태인지 (출력이 있거나 스트리밍 중)
  const canExpand = hasOutput || isStreaming;

  return (
    <div className="ml-2">
      <div
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 text-xs",
          "border-border border-l-2",
          "bg-muted/20 rounded-r",
          canExpand && "hover:bg-muted/40 cursor-pointer",
        )}
        onClick={canExpand ? onToggle : undefined}
      >
        {/* 확장/축소 아이콘 */}
        {canExpand ? (
          isExpanded ? (
            <ChevronDown className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
          )
        ) : (
          <MessageSquare className="text-muted-foreground mt-0.5 h-3 w-3 flex-shrink-0" />
        )}

        {/* 노드 이름 및 상태 */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className="text-foreground font-medium">
            {humanizeNodeName(output.nodeName)}
          </span>
          {isStreaming ? (
            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-500" />
          ) : (
            <CheckCircle2 className="h-3 w-3 flex-shrink-0 text-green-500" />
          )}
        </div>

        {/* 미리보기 (접힌 상태일 때) */}
        {!isExpanded && hasOutput && (
          <span className="text-muted-foreground max-w-[300px] truncate">
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
            className="mt-1 mb-2 ml-5"
          >
            <div
              ref={contentRef}
              className="bg-muted/30 max-h-[300px] overflow-y-auto rounded p-2 text-xs"
            >
              <div className="text-foreground/80 break-words whitespace-pre-wrap">
                {output.fullOutput || (isStreaming ? "Generating..." : "")}
                {/* 스트리밍 중이면 커서 표시 */}
                {isStreaming && (
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-blue-500 align-middle" />
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
  const [manuallyToggledIds, setManuallyToggledIds] = useState<Set<string>>(
    new Set(),
  );
  const listContainerRef = useRef<HTMLDivElement>(null);
  const prevOutputsLengthRef = useRef(0);

  // 최종 노드가 아닌 출력만 필터링 (memoize로 안정적인 참조 유지)
  const intermediateOutputs = useMemo(
    () => outputs.filter((o) => !o.isFinal),
    [outputs],
  );

  // 스트리밍 중인 노드 ID들 (unique ID including namespace)
  const streamingNodeIds = useMemo(
    () =>
      intermediateOutputs
        .filter((o) => o.status === "streaming")
        .map((o) => o.nodeId)
        .sort()
        .join(","),
    [intermediateOutputs],
  );

  // 펼쳐진 노드들: 스트리밍 중인 것은 자동 펼침 + 수동 토글된 것 유지
  // useEffect 대신 렌더링 중에 파생 (rerender-derived-state-no-effect)
  const expandedNodeIds = useMemo(() => {
    const expanded = new Set<string>();
    // 스트리밍 중인 항목은 자동으로 펼침
    if (streamingNodeIds) {
      for (const id of streamingNodeIds.split(",")) {
        if (id) expanded.add(id);
      }
    }
    // 수동으로 토글된 항목 추가
    for (const id of manuallyToggledIds) {
      if (expanded.has(id)) {
        expanded.delete(id); // 스트리밍 중인데 수동으로 접은 경우
      } else {
        expanded.add(id); // 스트리밍 아닌데 수동으로 펼친 경우
      }
    }
    return expanded;
  }, [streamingNodeIds, manuallyToggledIds]);

  // 하나라도 펼쳐져 있으면 자동 스크롤
  const hasAnyExpanded = expandedNodeIds.size > 0;

  // 스트리밍 중인 출력의 콘텐츠 (스트리밍 상태 변경 감지용)
  const streamingContentSignature = useMemo(
    () =>
      intermediateOutputs
        .filter((o) => o.status === "streaming")
        .map((o) => o.fullOutput.length)
        .join(","),
    [intermediateOutputs],
  );

  // 새 출력 추가 또는 스트리밍 콘텐츠 변경 시 자동 스크롤
  const outputsLength = intermediateOutputs.length;
  useEffect(() => {
    const container = listContainerRef.current;
    // 새 출력이 추가되었거나 스트리밍 콘텐츠가 변경된 경우 스크롤
    if (!isCollapsed && container && hasAnyExpanded) {
      container.scrollTop = container.scrollHeight;
    }
    prevOutputsLengthRef.current = outputsLength;
  }, [outputsLength, streamingContentSignature, hasAnyExpanded, isCollapsed]);

  // 토글 핸들러 - 수동 토글 상태만 관리
  const handleToggle = useCallback((nodeId: string) => {
    setManuallyToggledIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  if (intermediateOutputs.length === 0) return null;

  const SectionChevron = isCollapsed ? ChevronRight : ChevronDown;

  return (
    <div className="border-border/50 bg-card overflow-hidden rounded-lg border">
      {/* 헤더 */}
      <div
        className="bg-muted/30 border-border/50 hover:bg-muted/50 flex cursor-pointer items-center gap-2 border-b px-3 py-2 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <SectionChevron className="text-muted-foreground h-4 w-4" />
        <MessageSquare className="text-muted-foreground h-4 w-4" />
        <span className="text-foreground text-sm font-medium">
          Background activity
        </span>
        <span className="text-muted-foreground text-xs">
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
            ref={listContainerRef}
            className="max-h-[250px] overflow-y-auto py-1"
          >
            {intermediateOutputs.map((output) => (
              <IntermediateLLMOutputItem
                key={output.nodeId}
                output={output}
                isExpanded={expandedNodeIds.has(output.nodeId)}
                onToggle={() => handleToggle(output.nodeId)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
