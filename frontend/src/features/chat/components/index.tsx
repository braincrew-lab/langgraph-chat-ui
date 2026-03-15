import { v4 as uuidv4 } from "uuid";
import {
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useState,
  FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { UI, STREAM_OPTIONS, TIMING } from "@/lib/constants";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { ensureToolCallsHaveResponses } from "@/lib/utils/ensure-tool-responses";
import { LoaderCircle, BookOpen } from "lucide-react";
import { useLangSmithRuns } from "@/features/chat/hooks/useLangSmithRuns";
import { useStreamingView } from "@/features/chat/hooks/useStreamingView";
import {
  mapRunToToolCallEvent,
  mapRunToToolResultEvent,
  mapRunToLLMEvent,
  mapRunToMiddlewareEvent,
} from "@/types/langsmith";
import { type LangSmithTimelineEvents } from "@/types/timeline";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom } from "use-stick-to-bottom";
import ThreadHistory from "@/features/history";
import { toast } from "sonner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import {
  StickyToBottomContent,
  ScrollToBottom,
  ThreadHeader,
  ThreadTracingSidebar,
} from "./thread";
import { useFileUpload } from "@/shared/hooks/useFileUpload";
import { useSettings } from "@/shared/hooks/useSettings";
import { FullDescriptionModal } from "./modals/FullDescriptionModal";
import { useAssistantConfig } from "@/shared/hooks/useAssistantConfig";
import { ChatOpeners } from "./input/ChatOpeners";
import { useSchemaUI } from "@/features/chat/hooks/useSchemaUI";
import { UnifiedInputArea } from "./schema-ui";
import type { FormState, SchemaFieldConfig } from "@/types/schema-ui";
import { updateAssistantIdAction } from "@/app/actions";
import { MessageList } from "./MessageList";

export function Thread() {
  const { config, userSettings, updateUserSettings } = useSettings();
  const t = useTranslations("chat");
  const router = useRouter();

  const [threadId, setThreadId] = useQueryState("threadId");

  // Sidebar states from settings (persisted)
  const chatHistoryOpen = userSettings.chatHistoryOpen;
  const setChatHistoryOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue =
        typeof value === "function" ? value(chatHistoryOpen) : value;
      updateUserSettings({ chatHistoryOpen: newValue });
    },
    [chatHistoryOpen, updateUserSettings],
  );

  const sidebarOpen = userSettings.tracingPanelOpen;
  const setSidebarOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === "function" ? value(sidebarOpen) : value;
      updateUserSettings({ tracingPanelOpen: newValue });
    },
    [sidebarOpen, updateUserSettings],
  );

  // 컴팩트 뷰 모드 (스트리밍 태스크 뷰 사용)
  const [compactView, setCompactView] = useQueryState(
    "compactView",
    parseAsBoolean.withDefault(true),
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
  const {
    assistantId: currentAssistantId,
    assistants,
    assistantsLoading,
    refetchAssistants,
    finalNodeNames,
  } = useAssistantConfig();

  // LangSmith API 연동 (disabled when env vars not configured)
  const langsmithEnabled = config.langsmithEnabled;
  const {
    runs: allRuns,
    middlewareRuns: langSmithMiddlewareRuns,
    toolRuns: langSmithToolRuns,
    llmRuns: langSmithLLMRuns,
    loading: langSmithLoading,
    refetch: refetchLangSmith,
  } = useLangSmithRuns(langsmithEnabled ? threadId : null, null, {
    pollingInterval: TIMING.POLLING_INTERVAL,
    autoPolling: langsmithEnabled && isLoading,
  });

  // LangSmith runs를 타임라인 이벤트로 변환
  const langSmithEvents: LangSmithTimelineEvents = useMemo(() => {
    return {
      middlewares: langSmithMiddlewareRuns.map(mapRunToMiddlewareEvent),
      toolCalls: langSmithToolRuns.map(mapRunToToolCallEvent),
      toolResults: langSmithToolRuns
        .filter((run) => run.status === "success" || run.status === "error")
        .map(mapRunToToolResultEvent),
      llmEnds: langSmithLLMRuns.map(mapRunToLLMEvent),
    };
  }, [langSmithMiddlewareRuns, langSmithToolRuns, langSmithLLMRuns]);

  // 스트리밍 뷰 상태 (TODO 라이프사이클 등)
  const {
    progress,
    todoLifecycle,
    hasVisibleContent,
    showTaskView,
    activeLeafTasks,
    intermediateOutputs,
    finalNodeId,
  } = useStreamingView(allRuns, isLoading, messages, {
    nodeUpdates,
    finalNodeNames,
    updateNodeCompletedOutput,
  });

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
    () => currentAssistantId?.trim() || "none",
    [currentAssistantId],
  );

  const isAssistantSelected = Boolean(currentAssistantId?.trim());

  const handleAssistantChange = useCallback(
    async (value: string) => {
      if (value === "none") {
        if (currentAssistantId) {
          await updateAssistantIdAction(null);
          window.location.reload();
        }
        return;
      }

      const trimmedValue = value.trim();
      if (!trimmedValue || trimmedValue === currentAssistantId?.trim()) {
        return;
      }

      // Update cookie via server action and do full page reload
      await updateAssistantIdAction(trimmedValue);
      toast.success(t("graphChanged"), {
        description: t("graphChangedDescription", { assistantId: value }),
      });
      // Full page reload to ensure cookie is properly read
      window.location.reload();
    },
    [currentAssistantId, router, setThreadId, setContentBlocks, t],
  );

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

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!isAssistantSelected) {
        toast.error(t("selectGraph"));
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
    },
    [
      isAssistantSelected,
      input,
      contentBlocks,
      isLoading,
      stream,
      setContentBlocks,
      getSubmitPayload,
      t,
    ],
  );

  const handleRegenerate = useCallback(
    (parentCheckpoint: Checkpoint | null | undefined) => {
      // Do this so the loading state is correct
      prevMessageLength.current = prevMessageLength.current - 1;
      setFirstTokenReceived(false);
      stream.submit(undefined, {
        checkpoint: parentCheckpoint,
        ...STREAM_OPTIONS,
      });
    },
    [stream],
  );

  // Form mode submission handler
  const handleFormSubmit = useCallback(() => {
    if (!isAssistantSelected) {
      toast.error(t("selectGraph"));
      return;
    }

    const payload = getSubmitPayload();
    const allFields = [
      ...parsedSchema.requiredFields,
      ...parsedSchema.optionalFields,
    ];

    // Save form submission for display
    setFormSubmissions((prev) => [
      ...prev,
      { data: payload, fields: allFields, timestamp: new Date() },
    ]);

    setFirstTokenReceived(false);
    stream.submit(payload, STREAM_OPTIONS);
    resetForm();
  }, [
    isAssistantSelected,
    getSubmitPayload,
    parsedSchema,
    stream,
    resetForm,
    t,
  ]);

  const chatStarted =
    !!threadId || !!messages.length || formSubmissions.length > 0;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {config.threads.showHistory && (
        <div className="relative hidden lg:flex">
          <motion.div
            className="border-border bg-sidebar absolute z-20 h-full overflow-hidden border-r"
            style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            initial={false}
            animate={{ x: chatHistoryOpen ? 0 : -UI.CHAT_SIDEBAR_WIDTH }}
            transition={
              isLargeScreen
                ? { type: "spring", stiffness: 300, damping: 30 }
                : { duration: 0 }
            }
          >
            <div
              className="relative flex h-full flex-col"
              style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            >
              <div className="flex-1 overflow-hidden">
                <ThreadHistory
                  onShowGuide={() => setFullDescriptionOpen(true)}
                  chatHistoryOpen={chatHistoryOpen}
                  onChatHistoryOpenChange={setChatHistoryOpen}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <div
        className="grid w-full transition-all duration-500"
        style={{
          gridTemplateColumns: sidebarOpen
            ? `1fr ${UI.TRACING_SIDEBAR_WIDTH}px`
            : "1fr 0fr",
        }}
      >
        <div
          className={cn(
            "relative flex min-w-0 flex-1 flex-col overflow-hidden transition-all",
            !chatStarted && "grid-rows-[1fr]",
            isLargeScreen ? "duration-300" : "duration-0",
          )}
          style={{
            marginLeft:
              config.threads.showHistory && chatHistoryOpen
                ? isLargeScreen
                  ? 300
                  : 0
                : 0,
            width:
              config.threads.showHistory && chatHistoryOpen
                ? isLargeScreen
                  ? "calc(100% - 300px)"
                  : "100%"
                : "100%",
          }}
        >
          <ThreadHeader
            config={config}
            chatStarted={chatStarted}
            chatHistoryOpen={chatHistoryOpen}
            setChatHistoryOpen={setChatHistoryOpen}
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            isLargeScreen={isLargeScreen}
            onLogoClick={() => setThreadId(null)}
          />

          <StickToBottom
            resize="smooth"
            className="relative mt-[68px] flex-1 overflow-hidden"
          >
            <StickyToBottomContent
              className={cn(
                "[&::-webkit-scrollbar-thumb]:bg-border absolute inset-0 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent",
                !chatStarted &&
                  "mt-0 flex flex-col items-stretch justify-center",
                chatStarted && "grid grid-rows-[1fr_auto]",
                userSettings.chatWidth === "default" ? "px-4" : "px-2",
              )}
              contentClassName={cn(
                messages.length > 0 || formSubmissions.length > 0
                  ? "pt-8 pb-16 mx-auto flex flex-col gap-6 w-full"
                  : "",
                userSettings.chatWidth === "default"
                  ? "max-w-3xl"
                  : "max-w-5xl",
              )}
              content={
                <MessageList
                  messages={messages}
                  isLoading={isLoading}
                  isFormMode={isFormMode}
                  formSubmissions={formSubmissions}
                  compactView={compactView ?? true}
                  hasVisibleContent={hasVisibleContent}
                  showTaskView={showTaskView}
                  progress={progress}
                  activeLeafTasks={activeLeafTasks}
                  intermediateOutputs={intermediateOutputs}
                  finalNodeId={finalNodeId}
                  finalNodeNames={finalNodeNames}
                  todoLifecycle={todoLifecycle}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={setSelectedTaskId}
                  handleRegenerate={handleRegenerate}
                  firstTokenReceived={firstTokenReceived}
                  interrupt={stream.interrupt}
                />
              }
              footer={
                <div className="sticky bottom-0 flex flex-col items-center gap-10 bg-none">
                  {!chatStarted && (
                    <div
                      className={cn(
                        "mx-auto flex w-full flex-col items-center gap-6",
                        userSettings.chatWidth === "default"
                          ? "max-w-3xl"
                          : "max-w-5xl",
                      )}
                    >
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
                            className="text-primary hover:text-primary/80 flex items-center gap-2 text-sm transition-colors"
                          >
                            <BookOpen className="h-4 w-4" />
                            <span>{t("viewFullDescription")}</span>
                          </button>
                        )}
                      </div>
                      {schemaUI.isLoading && (
                        <LoaderCircle className="text-muted-foreground h-6 w-6 animate-spin" />
                      )}
                      {config.branding.chatOpeners &&
                        config.branding.chatOpeners.length > 0 &&
                        !isFormMode &&
                        !schemaUI.isLoading && (
                          <ChatOpeners
                            disabled={isLoading || !isAssistantSelected}
                            chatOpeners={config.branding.chatOpeners}
                            onSelectOpener={(opener) => {
                              setInput(opener);
                              setTimeout(() => {
                                const form = document.querySelector("form");
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
                      userSettings.chatWidth === "default"
                        ? "max-w-3xl"
                        : "max-w-5xl",
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
                      compactView={compactView ?? true}
                      onCompactViewChange={(value) => setCompactView(value)}
                      assistants={assistants}
                      selectedAssistantId={assistantSelectValue}
                      assistantsLoading={assistantsLoading}
                      onAssistantChange={handleAssistantChange}
                      onRefreshAssistants={refetchAssistants}
                      isChatPage={!!threadId}
                    />
                  </div>
                </div>
              }
            />
          </StickToBottom>
        </div>

        {/* LangSmith Tracing sidebar */}
        {langsmithEnabled && sidebarOpen && (
          <ThreadTracingSidebar
            langSmithEvents={langSmithEvents}
            langSmithLoading={langSmithLoading}
            refetchLangSmith={refetchLangSmith}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
            onClose={() => setSidebarOpen(false)}
          />
        )}
      </div>
      <FullDescriptionModal
        open={fullDescriptionOpen}
        onOpenChange={setFullDescriptionOpen}
      />
    </div>
  );
}
