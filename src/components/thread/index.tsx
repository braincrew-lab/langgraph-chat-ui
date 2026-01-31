import { v4 as uuidv4 } from "uuid";
import { ReactNode, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UI, STREAM_OPTIONS, TIMING } from "@/lib/constants";
import { useStreamContext } from "@/hooks/useStreamContext";
import { useState, FormEvent } from "react";
import { Button } from "../ui/button";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import {
  DO_NOT_RENDER_ID_PREFIX,
  ensureToolCallsHaveResponses,
} from "@/lib/ensure-tool-responses";
import {
  ArrowDown,
  LoaderCircle,
  PanelRightOpen,
  PanelRightClose,
  XIcon,
  BookOpen,
  RefreshCw,
  PanelRight,
} from "lucide-react";
import { ExecutionTimelinePanel } from "./execution-timeline-panel";
import { StreamingTaskView } from "./streaming-task-view";
import { useLangSmithRuns } from "@/hooks/useLangSmithRuns";
import { useStreamingView } from "@/hooks/useStreamingView";
import {
  mapRunToToolCallEvent,
  mapRunToToolResultEvent,
  mapRunToLLMEvent,
  mapRunToMiddlewareEvent,
} from "@/types/langsmith";
import { type LangSmithTimelineEvents } from "@/types/timeline";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import ThreadHistory from "./history";
import { toast } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { GitHubSVG } from "../icons/github";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useSettings } from "@/hooks/useSettings";
import { FullDescriptionModal } from "./FullDescriptionModal";
import { useAssistantConfig } from "@/hooks/useAssistantConfig";
import { ChatOpeners } from "./ChatOpeners";
import { shouldRenderMessage, buildSubagentContext } from "./utils";
import { useSchemaUI } from "@/hooks/useSchemaUI";
import {
  UnifiedInputArea,
  FormSubmissionMessage,
} from "./schema-ui";
import type { FormState, SchemaFieldConfig } from "@/types/schema-ui";

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();
  return (
    <div
      ref={context.scrollRef}
      style={{ width: "100%", height: "100%" }}
      className={props.className}
    >
      <div
        ref={context.contentRef}
        className={props.contentClassName}
      >
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button
      variant="outline"
      className={props.className}
      onClick={() => scrollToBottom()}
    >
      <ArrowDown className="h-4 w-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function OpenGitHubRepo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href="https://github.com/teddylee777/agent-chat-ui"
            target="_blank"
            className="flex items-center justify-center pr-3 h-9"
          >
            <GitHubSVG
              width="24"
              height="24"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Open GitHub repo</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function Thread() {
  const { config, userSettings } = useSettings();

  const [threadId, setThreadId] = useQueryState("threadId");
  const [assistantQueryId, setAssistantQueryId] = useQueryState("assistantId");
  const [chatHistoryOpen, setChatHistoryOpen] = useQueryState(
    "chatHistoryOpen",
    parseAsBoolean.withDefault(config.threads.sidebarOpenByDefault),
  );
  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );
  // 컴팩트 뷰 모드 (스트리밍 태스크 뷰 사용)
  const [compactView, setCompactView] = useQueryState(
    "compactView",
    parseAsBoolean.withDefault(true),
  );
  // LangSmith Tracing 사이드바 열기/닫기 상태 (URL 쿼리 파라미터)
  const [sidebarOpen, setSidebarOpen] = useQueryState(
    "tracing",
    parseAsBoolean.withDefault(false),
  );
  const [input, setInput] = useState("");
  const [fullDescriptionOpen, setFullDescriptionOpen] = useState(false);
  // TODO ↔ 사이드바 연동을 위한 선택된 Task ID
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const {
    contentBlocks,
    setContentBlocks,
    handleFileUpload,
    dropRef,
    removeBlock,
    dragOver,
    handlePaste,
  } = useFileUpload();
  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  // Schema UI for dynamic form fields
  const schemaUI = useSchemaUI();
  const { parsedSchema, getSubmitPayload, resetForm } = schemaUI;
  const isFormMode = parsedSchema.uiMode === "form";

  // Form mode submission state
  const [formSubmissions, setFormSubmissions] = useState<
    Array<{ data: FormState; fields: SchemaFieldConfig[]; timestamp: Date }>
  >([]);

  const stream = useStreamContext();
  const messages = stream.messages;
  const isLoading = stream.isLoading;
  const nodeUpdates = stream.nodeUpdates;
  const updateNodeCompletedOutput = stream.updateNodeCompletedOutput;
  const toolCallNamespaceMap = stream.toolCallNamespaceMap;  // Phase 5: 병렬 Task 도구 분리용
  const {
    assistants,
    assistantsLoading,
    refetchAssistants,
    finalNodeNames,
  } = useAssistantConfig();

  // LangSmith API 연동 - threadId로 runs 조회
  // 스트리밍 중에만 2초 폴링 활성화
  const {
    runs: allRuns,
    middlewareRuns: langSmithMiddlewareRuns,
    toolRuns: langSmithToolRuns,
    llmRuns: langSmithLLMRuns,
    loading: langSmithLoading,
    refetch: refetchLangSmith,
  } = useLangSmithRuns(threadId, null, {
    pollingInterval: TIMING.POLLING_INTERVAL,
    autoPolling: isLoading, // 스트리밍 중에만 폴링
  });

  // LangSmith runs를 타임라인 이벤트로 변환
  const langSmithEvents: LangSmithTimelineEvents = useMemo(() => {
    return {
      middlewares: langSmithMiddlewareRuns.map(mapRunToMiddlewareEvent),
      toolCalls: langSmithToolRuns.map(mapRunToToolCallEvent),
      toolResults: langSmithToolRuns
        .filter(run => run.status === "success" || run.status === "error")
        .map(mapRunToToolResultEvent),
      llmEnds: langSmithLLMRuns.map(mapRunToLLMEvent),
    };
  }, [langSmithMiddlewareRuns, langSmithToolRuns, langSmithLLMRuns]);

  // 스트리밍 뷰 상태 (TODO 라이프사이클 등)
  const {
    todoLifecycle,
    hasVisibleContent,
    hierarchicalTodos,
    activeLeafTasks,
    intermediateOutputs,
    finalNodeId,
  } = useStreamingView(allRuns, isLoading, messages, { nodeUpdates, finalNodeNames, updateNodeCompletedOutput, toolCallNamespaceMap });

  // 서브에이전트 메시지 감지를 위한 컨텍스트
  const subagentContext = useMemo(() => {
    return buildSubagentContext(messages);
  }, [messages]);

  // 스트리밍 완료 시 LangSmith 재조회
  const prevIsLoading = useRef(isLoading);
  useEffect(() => {
    // isLoading이 true -> false로 변경되면 스트리밍 완료
    if (prevIsLoading.current && !isLoading) {
      // 스트리밍 완료 후 잠시 대기 후 LangSmith 조회 (트레이스 기록 시간 확보)
      setTimeout(() => {
        refetchLangSmith();
      }, TIMING.LANGSMITH_REFETCH_DELAY);
    }
    prevIsLoading.current = isLoading;
  }, [isLoading, refetchLangSmith]);

  // threadId 변경 시 화면 초기화
  const prevThreadId = useRef(threadId);
  useEffect(() => {
    // threadId가 변경된 경우
    if (prevThreadId.current !== threadId) {
      // 메인 페이지로 이동 (threadId가 null)
      if (threadId === null) {
        // 사이드바 닫기
        setSidebarOpen(false);
        // 입력 초기화
        setInput("");
        setContentBlocks([]);
        setFirstTokenReceived(false);
      }
      // 채팅 페이지로 이동 (threadId가 있음)
      // -> useLangSmithRuns 훅에서 threadId 변경 시 자동으로 데이터 재조회
    }
    prevThreadId.current = threadId;
  }, [threadId, setSidebarOpen, setContentBlocks]);

  const lastError = useRef<string | undefined>(undefined);

  const assistantSelectValue = useMemo(
    () => assistantQueryId?.trim() || "none",
    [assistantQueryId]
  );

  const isAssistantSelected = Boolean(assistantQueryId?.trim());

  const handleAssistantChange = useCallback((value: string) => {
    if (value === "none") {
      if (assistantQueryId) {
        void setAssistantQueryId(null);
      }
      setThreadId(null);
      setInput("");
      setContentBlocks([]);
      setFirstTokenReceived(false);
      return;
    }

    const trimmedValue = value.trim();
    if (!trimmedValue || trimmedValue === assistantQueryId?.trim()) {
      return;
    }

    void setAssistantQueryId(trimmedValue);
    setThreadId(null);
    setInput("");
    setContentBlocks([]);
    setFirstTokenReceived(false);
    toast.success("그래프가 변경되었습니다.", {
      description: `선택한 assistant ID: ${value}`,
    });
  }, [assistantQueryId, setAssistantQueryId, setThreadId, setContentBlocks]);

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as { message?: string }).message;
      if (!message || lastError.current === message) {
        // Message has already been logged. do not modify ref, return early.
        return;
      }

      // Message is defined, and it has not been logged yet. Save it, and send the error
      lastError.current = message;
      toast.error("An error occurred. Please try again.", {
        description: (
          <p>
            <strong>Error:</strong> <code>{message}</code>
          </p>
        ),
        richColors: true,
        closeButton: true,
      });
    } catch {
      // no-op
    }
  }, [stream.error]);

  // TODO: this should be part of the useStream hook
  const prevMessageLength = useRef(0);
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }

    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!isAssistantSelected) {
      toast.error("그래프를 먼저 선택해주세요.");
      return;
    }
    if (
      (input.trim().length === 0 && contentBlocks.length === 0) ||
      isLoading
    )
      return;
    setFirstTokenReceived(false);

    const newHumanMessage: Message = {
      id: uuidv4(),
      type: "human",
      content: [
        ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
        ...contentBlocks,
      ] as Message["content"],
    };

    const toolMessages = ensureToolCallsHaveResponses(stream.messages);

    // Get schema payload (additional fields from input_schema)
    const schemaPayload = getSubmitPayload();

    // 새 메시지 전송 전 노드 업데이트 초기화 (이전 노드 정보 클리어)
    stream.clearNodeUpdates();

    stream.submit(
      { messages: [...toolMessages, newHumanMessage], ...schemaPayload },
      {
        ...STREAM_OPTIONS,
        optimisticValues: (prev) => ({
          ...prev,
          messages: [
            ...(prev.messages ?? []),
            ...toolMessages,
            newHumanMessage,
          ],
        }),
      },
    );

    setInput("");
    setContentBlocks([]);
  }, [isAssistantSelected, input, contentBlocks, isLoading, stream, setContentBlocks, getSubmitPayload]);

  const handleRegenerate = useCallback((
    parentCheckpoint: Checkpoint | null | undefined,
  ) => {
    // Do this so the loading state is correct
    prevMessageLength.current = prevMessageLength.current - 1;
    setFirstTokenReceived(false);
    stream.submit(undefined, {
      checkpoint: parentCheckpoint,
      ...STREAM_OPTIONS,
    });
  }, [stream]);

  // Form mode submission handler
  const handleFormSubmit = useCallback(() => {
    if (!isAssistantSelected) {
      toast.error("그래프를 먼저 선택해주세요.");
      return;
    }

    const payload = getSubmitPayload();
    const allFields = [...parsedSchema.requiredFields, ...parsedSchema.optionalFields];

    // Save form submission for display
    setFormSubmissions((prev) => [
      ...prev,
      { data: payload, fields: allFields, timestamp: new Date() },
    ]);

    setFirstTokenReceived(false);
    stream.submit(payload, STREAM_OPTIONS);
    resetForm();
  }, [isAssistantSelected, getSubmitPayload, parsedSchema, stream, resetForm]);

  const chatStarted = !!threadId || !!messages.length || formSubmissions.length > 0;
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {config.threads.showHistory && (
        <div className="relative hidden lg:flex">
          <motion.div
            className="absolute z-20 h-full overflow-hidden border-r border-border bg-sidebar"
            style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            animate={
              isLargeScreen
                ? { x: chatHistoryOpen ? 0 : -UI.CHAT_SIDEBAR_WIDTH }
                : { x: chatHistoryOpen ? 0 : -UI.CHAT_SIDEBAR_WIDTH }
            }
            initial={{ x: -UI.CHAT_SIDEBAR_WIDTH }}
            transition={
              isLargeScreen
                ? { type: "spring", stiffness: 300, damping: 30 }
                : { duration: 0 }
            }
          >
            <div
              className="relative h-full flex flex-col"
              style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            >
              <div className="flex-1 overflow-hidden">
                <ThreadHistory onShowGuide={() => setFullDescriptionOpen(true)} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div
        className="grid w-full transition-all duration-500"
        style={{
          gridTemplateColumns: sidebarOpen ? `1fr ${UI.TRACING_SIDEBAR_WIDTH}px` : '1fr 0fr',
        }}
      >
        <motion.div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden",
            !chatStarted && "grid-rows-[1fr]",
          )}
          layout={isLargeScreen}
          animate={{
            marginLeft: config.threads.showHistory && chatHistoryOpen ? (isLargeScreen ? 300 : 0) : 0,
            width: config.threads.showHistory && chatHistoryOpen
              ? isLargeScreen
                ? "calc(100% - 300px)"
                : "100%"
              : "100%",
          }}
          transition={
            isLargeScreen
              ? { type: "spring", stiffness: 300, damping: 30 }
              : { duration: 0 }
          }
        >
          {!chatStarted && (
            <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-4">
              <div>
                {config.threads.showHistory && (!chatHistoryOpen || !isLargeScreen) && (
                  <Button
                    className="hover:bg-accent cursor-pointer"
                    variant="ghost"
                    onClick={() => setChatHistoryOpen((p) => !p)}
                  >
                    {chatHistoryOpen ? (
                      <PanelRightOpen className="size-5" />
                    ) : (
                      <PanelRightClose className="size-5" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* 사이드바 토글 버튼 */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        className={cn(
                          "h-9 w-9",
                          sidebarOpen && "bg-accent"
                        )}
                      >
                        <PanelRight className="size-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>{sidebarOpen ? "Close tracing panel" : "Open tracing panel"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <OpenGitHubRepo />
              </div>
            </div>
          )}
          {chatStarted && (
            <div className="absolute top-0 left-0 z-10 w-full flex items-center justify-between gap-3 p-4">
              <div className="relative flex items-center justify-start gap-2">
                <div className="absolute left-0 z-10">
                  {config.threads.showHistory && (!chatHistoryOpen || !isLargeScreen) && (
                    <Button
                      className="hover:bg-accent"
                      variant="ghost"
                      onClick={() => setChatHistoryOpen((p) => !p)}
                    >
                      {chatHistoryOpen ? (
                        <PanelRightOpen className="size-5" />
                      ) : (
                        <PanelRightClose className="size-5" />
                      )}
                    </Button>
                  )}
                </div>
                <motion.button
                  className="flex cursor-pointer items-center gap-2 ml-2"
                  onClick={() => setThreadId(null)}
                  animate={{
                    translateX: config.threads.showHistory && !chatHistoryOpen ? 48 : 0,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={config.branding.logoPath}
                    alt="Logo"
                    width={config.branding.logoWidth}
                    height={config.branding.logoHeight}
                  />
                  <span className="text-xl font-semibold tracking-tight">
                    {config.branding.appName}
                  </span>
                </motion.button>
              </div>

              <div className="flex items-center gap-2">
                {/* 사이드바 토글 버튼 */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        className={cn(
                          "h-9 w-9",
                          sidebarOpen && "bg-accent"
                        )}
                      >
                        <PanelRight className="size-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>{sidebarOpen ? "Close tracing panel" : "Open tracing panel"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <OpenGitHubRepo />
              </div>

              <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
            </div>
          )}

          <StickToBottom className="relative mt-[68px] flex-1 overflow-hidden">
            <StickyToBottomContent
              className={cn(
                "absolute inset-0 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted && "mt-0 flex flex-col items-stretch justify-center",
                chatStarted && "grid grid-rows-[1fr_auto]",
                userSettings.chatWidth === "default" ? "px-4" : "px-2",
              )}
              contentClassName={cn(
                (messages.length > 0 || formSubmissions.length > 0) ? "pt-8 pb-16 mx-auto flex flex-col gap-6 w-full" : "",
                userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"
              )}
              content={
                <>
                  {/* Form mode: render form submissions */}
                  {isFormMode && formSubmissions.map((submission, idx) => (
                    <FormSubmissionMessage
                      key={`form-submission-${idx}`}
                      formData={submission.data}
                      fields={submission.fields}
                      timestamp={submission.timestamp}
                    />
                  ))}

                  {/* 메시지를 원래 순서대로 렌더링 (Human-AI-Human-AI 순서 유지) */}
                  {(() => {
                    const filteredMessages = messages.filter(
                      (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)
                    );

                    // 마지막 human 메시지 인덱스 찾기
                    let lastHumanIndex = -1;
                    for (let i = filteredMessages.length - 1; i >= 0; i--) {
                      if (filteredMessages[i].type === "human") {
                        lastHumanIndex = i;
                        break;
                      }
                    }
                    // nodeUpdates에서 마지막 노드 이름 찾기 (hasMessages 필터링 제거)
                    const sortedNodeUpdates = nodeUpdates?.slice().sort((a, b) => a.timestamp - b.timestamp) || [];
                    const lastNodeName = sortedNodeUpdates.length > 0
                      ? sortedNodeUpdates[sortedNodeUpdates.length - 1].nodeName
                      : null;

                    // 마지막 AI 메시지만 표시 (가장 마지막에 추가된 AI 메시지 = 마지막 노드의 출력)
                    let lastAiMessageId: string | null = null;
                    if (compactView && hasVisibleContent) {
                      const startIndex = lastHumanIndex >= 0 ? lastHumanIndex : -1;
                      for (let i = filteredMessages.length - 1; i > startIndex; i--) {
                        const msg = filteredMessages[i];
                        if (msg.type === "ai") {
                          const content = msg.content;
                          const hasTextContent = typeof content === "string"
                            ? content.trim().length > 0
                            : Array.isArray(content) && content.some(
                                (c: unknown) => typeof c === "object" && c !== null && "type" in c &&
                                (c as { type: string }).type === "text" && "text" in c &&
                                typeof (c as { text: unknown }).text === "string" &&
                                ((c as { text: string }).text).trim().length > 0
                              );
                          if (hasTextContent) {
                            lastAiMessageId = msg.id ?? null;
                            break;
                          }
                        }
                      }
                    }

                    const elements: React.ReactNode[] = [];

                    // Human 메시지가 없는 경우 맨 앞에 StreamingTaskView 삽입
                    if (compactView && hasVisibleContent && lastHumanIndex === -1) {
                      elements.push(
                        <StreamingTaskView
                          key="streaming-task-view"
                          hierarchicalTodos={hierarchicalTodos}
                          activeLeafTasks={activeLeafTasks}
                          isStreaming={isLoading}
                          selectedTaskId={selectedTaskId}
                          onSelectTask={setSelectedTaskId}
                          intermediateOutputs={intermediateOutputs}
                          finalNodeId={finalNodeId}
                        />
                      );
                    }

                    filteredMessages.forEach((message, index) => {
                      // 고유 키 생성 (message.id가 중복될 수 있으므로 index 포함)
                      const messageKey = message.id ? `${message.type}-${message.id}-${index}` : `${message.type}-${index}`;

                      if (message.type === "human") {
                        // Human 메시지 렌더링
                        elements.push(
                          <HumanMessage
                            key={messageKey}
                            message={message}
                            isLoading={isLoading}
                          />
                        );

                        // 마지막 Human 메시지 다음에 StreamingTaskView 삽입 (컨텐츠가 있을 때만)
                        if (compactView && hasVisibleContent && index === lastHumanIndex) {
                          elements.push(
                            <StreamingTaskView
                              key="streaming-task-view"
                              hierarchicalTodos={hierarchicalTodos}
                              activeLeafTasks={activeLeafTasks}
                              isStreaming={isLoading}
                              selectedTaskId={selectedTaskId}
                              onSelectTask={setSelectedTaskId}
                              intermediateOutputs={intermediateOutputs}
                              finalNodeId={finalNodeId}
                            />
                          );
                        }
                      } else {
                        // AI/Tool 메시지 필터링
                        const isAfterLastHuman = lastHumanIndex >= 0 && index > lastHumanIndex;
                        // Human 메시지가 없는 경우에도 compactView 필터링 적용
                        const shouldApplyCompactFilter = compactView && hasVisibleContent && (isAfterLastHuman || lastHumanIndex === -1);

                        // compactView + TODO/Intermediate 박스 표시: 스트리밍 중에는 모든 AI 메시지 숨김
                        if (shouldApplyCompactFilter) {
                          // tool 메시지는 숨김
                          if (message.type === "tool") {
                            return;
                          }
                          // AI 메시지 처리
                          if (message.type === "ai") {
                            // 서브에이전트 메시지는 항상 숨김
                            if (subagentContext.subagentMessageIds.has(message.id || "")) {
                              return;
                            }
                            // 스트리밍 중에는 모든 AI 메시지 숨김 (compact 박스에서만 표시)
                            // 스트리밍 완료 후에만 마지막 AI 메시지 표시
                            if (isLoading || message.id !== lastAiMessageId) {
                              return;
                            }
                          }
                        }

                        // 그 외의 경우 기존 shouldRenderMessage 로직 사용
                        if (!shouldApplyCompactFilter) {
                          if (!shouldRenderMessage(
                            message,
                            todoLifecycle,
                            compactView,
                            false,
                            subagentContext,
                            filteredMessages
                          )) {
                            return;
                          }
                        }

                        elements.push(
                          <AssistantMessage
                            key={messageKey}
                            message={message}
                            isLoading={isLoading}
                            handleRegenerate={handleRegenerate}
                            compactView={compactView}
                          />
                        );
                      }
                    });

                    return elements;
                  })()}

                  {/* Special rendering case where there are no AI/tool messages, but there is an interrupt. */}
                  {hasNoAIOrToolMessages && !!stream.interrupt && (
                    <AssistantMessage
                      key="interrupt-msg"
                      message={undefined}
                      isLoading={isLoading}
                      handleRegenerate={handleRegenerate}
                      compactView={compactView}
                    />
                  )}
                  {isLoading && !firstTokenReceived && (
                    <AssistantMessageLoading />
                  )}
                </>
              }
              footer={
                <div className="sticky bottom-0 flex flex-col items-center gap-10 bg-none">
                  {!chatStarted && (
                    <div className={cn(
                      "flex flex-col items-center gap-6 w-full mx-auto",
                      userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"
                    )}>
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={config.branding.logoPath}
                            alt="Logo"
                            width={config.branding.logoWidth * 1.5}
                            height={config.branding.logoHeight * 1.5}
                            className="flex-shrink-0"
                          />
                          <h1 className="text-2xl font-semibold tracking-tight">
                            {config.branding.appName}
                          </h1>
                        </div>
                        {config.branding.description && (
                          <p className="text-muted-foreground text-center text-sm">
                            {config.branding.description}
                          </p>
                        )}
                        {config.branding.fullDescription && (
                          <button
                            onClick={() => setFullDescriptionOpen(true)}
                            className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            <BookOpen className="h-4 w-4" />
                            <span>자세한 설명 보기</span>
                          </button>
                        )}
                      </div>
                      {schemaUI.isLoading && (
                        <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                      )}
                      {config.branding.chatOpeners && config.branding.chatOpeners.length > 0 && !isFormMode && !schemaUI.isLoading && (
                        <ChatOpeners
                          disabled={isLoading || !isAssistantSelected}
                          chatOpeners={config.branding.chatOpeners}
                          onSelectOpener={(opener) => {
                            setInput(opener);
                            setTimeout(() => {
                              const form = document.querySelector('form');
                              form?.requestSubmit();
                            }, 0);
                          }}
                        />
                      )}
                    </div>
                  )}

                  <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                  {/* Input area container */}
                  <div
                    className={cn(
                      "relative z-10 mx-auto mb-8 w-full",
                      userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl",
                    )}
                  >
                    {/* Unified input area - handles both Form and Chat modes */}
                    <UnifiedInputArea
                      schemaUI={schemaUI}
                      isFormMode={isFormMode}
                      onFormSubmit={handleFormSubmit}
                      input={input}
                      onInputChange={setInput}
                      onChatSubmit={handleSubmit}
                      contentBlocks={contentBlocks}
                      onRemoveBlock={removeBlock}
                      onFileUpload={handleFileUpload}
                      onPaste={handlePaste}
                      dropRef={dropRef}
                      dragOver={dragOver}
                      isLoading={isLoading}
                      onStop={() => stream.stop()}
                      isAssistantSelected={isAssistantSelected}
                      enableFileUpload={config.buttons.enableFileUpload}
                      placeholder={config.buttons.chatInputPlaceholder}
                      hideToolCalls={hideToolCalls ?? false}
                      onHideToolCallsChange={(value) => setHideToolCalls(value)}
                      compactView={compactView ?? true}
                      onCompactViewChange={(value) => setCompactView(value)}
                      assistants={assistants}
                      selectedAssistantId={assistantSelectValue}
                      assistantsLoading={assistantsLoading}
                      onAssistantChange={handleAssistantChange}
                      onRefreshAssistants={refetchAssistants}
                    />
                  </div>
                </div>
              }
            />
          </StickToBottom>
        </motion.div>

        {/* LangSmith Tracing 사이드바 */}
        {sidebarOpen && (
          <div
            className="relative flex flex-col border-l h-full overflow-hidden"
            style={{ width: UI.TRACING_SIDEBAR_WIDTH }}
          >
            {/* 헤더 */}
            <div className="flex-shrink-0 flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-semibold">LangSmith Tracing</h2>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => refetchLangSmith()}
                        disabled={langSmithLoading}
                        className="flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        <RefreshCw
                          className={cn(
                            "h-4 w-4",
                            langSmithLoading && "animate-spin"
                          )}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <p>Refresh</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center justify-center h-8 w-8 rounded-lg transition-colors hover:bg-accent"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 컨텐츠 */}
            <div className="flex-1 overflow-y-auto">
              <ExecutionTimelinePanel
                langSmithEvents={langSmithEvents}
                selectedTaskId={selectedTaskId}
                onSelectTask={setSelectedTaskId}
              />
            </div>
          </div>
        )}
      </div>
      <FullDescriptionModal
        open={fullDescriptionOpen}
        onOpenChange={setFullDescriptionOpen}
      />
    </div>
  );
}
