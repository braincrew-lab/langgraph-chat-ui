/**
 * ThreadContent - Chat content without sidebar
 * The sidebar is now rendered in the shared layout (MainLayoutClient)
 */

import { v4 as uuidv4 } from "uuid";
import { useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { UI, STREAM_OPTIONS, TIMING } from "@/lib/constants";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { useState, FormEvent } from "react";
import { Button } from "@/shared/components/ui/button";
import type { Checkpoint, Message } from "@langchain/langgraph-sdk";
import { ensureToolCallsHaveResponses } from "@/lib/utils/ensure-tool-responses";
import { ArrowDown, LoaderCircle, BookOpen } from "lucide-react";
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
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { toast } from "sonner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
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
import { TracingSidebar } from "./sidebar/TracingSidebar";
import { ThreadErrorBoundary } from "./ThreadErrorBoundary";

// ============================================
// Scroll Components
// ============================================

function StickyToBottomContent(props: {
  content: React.ReactNode;
  footer?: React.ReactNode;
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
      <div ref={context.contentRef} className={props.contentClassName}>
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

// ============================================
// Main Component
// ============================================

export function ThreadContent() {
  const { config, userSettings, updateUserSettings, globalSettings } = useSettings();
  const [threadId] = useQueryState("threadId");

  // Tracing panel state
  const sidebarOpen = userSettings.tracingPanelOpen;
  const setSidebarOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === "function" ? value(sidebarOpen) : value;
      updateUserSettings({ tracingPanelOpen: newValue });
    },
    [sidebarOpen, updateUserSettings]
  );

  const [hideToolCalls, setHideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false)
  );
  const [compactView, setCompactView] = useQueryState(
    "compactView",
    parseAsBoolean.withDefault(true)
  );
  const [input, setInput] = useState("");
  const [fullDescriptionOpen, setFullDescriptionOpen] = useState(false);
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
  const messageNodeMap = stream.messageNodeMap;
  const {
    assistantId: currentAssistantId,
    assistants,
    assistantsLoading,
    refetchAssistants,
    finalNodeNames,
  } = useAssistantConfig();

  // LangSmith API
  const {
    runs: allRuns,
    middlewareRuns: langSmithMiddlewareRuns,
    toolRuns: langSmithToolRuns,
    llmRuns: langSmithLLMRuns,
    loading: langSmithLoading,
    refetch: refetchLangSmith,
  } = useLangSmithRuns(threadId, null, {
    pollingInterval: TIMING.POLLING_INTERVAL,
    autoPolling: isLoading,
  });

  // LangSmith runs to timeline events
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

  // Streaming view state (flat list with grouping)
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
    getMessagesMetadata: stream.getMessagesMetadata,
    messageNodeMap,
  });

  // Refetch LangSmith when streaming completes
  const prevIsLoading = useRef(isLoading);
  useEffect(() => {
    if (prevIsLoading.current && !isLoading) {
      setTimeout(() => {
        refetchLangSmith();
      }, TIMING.LANGSMITH_REFETCH_DELAY);
    }
    prevIsLoading.current = isLoading;
  }, [isLoading, refetchLangSmith]);

  // Reset on threadId change
  const prevThreadId = useRef(threadId);
  useEffect(() => {
    if (prevThreadId.current !== threadId) {
      if (threadId === null) {
        setSidebarOpen(false);
        setInput("");
        setContentBlocks([]);
        setFirstTokenReceived(false);
      }
    }
    prevThreadId.current = threadId;
  }, [threadId, setSidebarOpen, setContentBlocks]);

  const lastError = useRef<string | undefined>(undefined);

  const assistantSelectValue = useMemo(
    () => currentAssistantId?.trim() || "none",
    [currentAssistantId]
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

      await updateAssistantIdAction(trimmedValue);
      toast.success("그래프가 변경되었습니다.", {
        description: `선택한 assistant ID: ${value}`,
      });
      window.location.reload();
    },
    [currentAssistantId]
  );

  useEffect(() => {
    if (!stream.error) {
      lastError.current = undefined;
      return;
    }
    try {
      const message = (stream.error as { message?: string }).message;
      if (!message || lastError.current === message) {
        return;
      }

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
        toast.error("그래프를 먼저 선택해주세요.");
        return;
      }
      if ((input.trim().length === 0 && contentBlocks.length === 0) || isLoading) {
        return;
      }
      setFirstTokenReceived(false);

      const schemaPayload = getSubmitPayload();
      stream.clearNodeUpdates();

      if (parsedSchema.hasMessages) {
        const newHumanMessage: Message = {
          id: uuidv4(),
          type: "human",
          content: [
            ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
            ...contentBlocks,
          ] as Message["content"],
        };

        const toolMessages = ensureToolCallsHaveResponses(stream.messages);

        stream.submit(
          { messages: [...toolMessages, newHumanMessage], ...schemaPayload },
          {
            ...STREAM_OPTIONS,
            optimisticValues: (prev) => ({
              ...prev,
              messages: [...(prev.messages ?? []), ...toolMessages, newHumanMessage],
            }),
          }
        );
      } else {
        stream.submit(schemaPayload, STREAM_OPTIONS);
      }

      setInput("");
      setContentBlocks([]);
    },
    [isAssistantSelected, input, contentBlocks, isLoading, stream, setContentBlocks, getSubmitPayload, parsedSchema.hasMessages]
  );

  const handleRegenerate = useCallback(
    (parentCheckpoint: Checkpoint | null | undefined) => {
      prevMessageLength.current = prevMessageLength.current - 1;
      setFirstTokenReceived(false);
      stream.submit(undefined, {
        checkpoint: parentCheckpoint,
        ...STREAM_OPTIONS,
      });
    },
    [stream]
  );

  const handleFormSubmit = useCallback(() => {
    if (!isAssistantSelected) {
      toast.error("그래프를 먼저 선택해주세요.");
      return;
    }

    const payload = getSubmitPayload();
    const allFields = [...parsedSchema.requiredFields, ...parsedSchema.optionalFields];

    setFormSubmissions((prev) => [
      ...prev,
      { data: payload, fields: allFields, timestamp: new Date() },
    ]);

    setFirstTokenReceived(false);
    stream.submit(payload, STREAM_OPTIONS);
    resetForm();
  }, [isAssistantSelected, getSubmitPayload, parsedSchema, stream, resetForm]);

  const chatStarted = !!threadId || !!messages.length || formSubmissions.length > 0;

  return (
    <ThreadErrorBoundary>
      <div className="flex h-full w-full overflow-hidden">
        <div
          className="grid w-full transition-all duration-500"
          style={{
            gridTemplateColumns: sidebarOpen ? `1fr ${UI.TRACING_SIDEBAR_WIDTH}px` : "1fr 0fr",
          }}
        >
          <div
            className={cn(
              "relative flex min-w-0 flex-1 flex-col overflow-hidden transition-all",
              !chatStarted && "grid-rows-[1fr]",
              isLargeScreen ? "duration-300" : "duration-0"
            )}
          >
            <StickToBottom resize="smooth" className="relative flex-1 overflow-hidden">
              <StickyToBottomContent
                className={cn(
                  "absolute inset-0 overflow-y-scroll [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent",
                  !chatStarted && "mt-0 flex flex-col items-stretch justify-center",
                  chatStarted && "grid grid-rows-[1fr_auto]",
                  userSettings.chatWidth === "default" ? "px-4" : "px-2"
                )}
                contentClassName={cn(
                  messages.length > 0 || formSubmissions.length > 0
                    ? "pt-8 pb-16 mx-auto flex flex-col gap-6 w-full"
                    : "",
                  userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"
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
                          "flex flex-col items-center gap-6 w-full mx-auto",
                          userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"
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

                    <div
                      className={cn(
                        "relative z-10 mx-auto mb-8 w-full",
                        userSettings.chatWidth === "default" ? "max-w-3xl" : "max-w-5xl"
                      )}
                    >
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
                        isChatPage={!!threadId}
                        enableGraphSelection={globalSettings["features.enableGraphSelection"]}
                        enableAdvancedInput={globalSettings["features.enableAdvancedInput"]}
                      />
                    </div>
                  </div>
                }
              />
            </StickToBottom>
          </div>

          {/* LangSmith Tracing Sidebar */}
          <TracingSidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            langSmithEvents={langSmithEvents}
            langSmithLoading={langSmithLoading}
            onRefresh={refetchLangSmith}
            selectedTaskId={selectedTaskId}
            onSelectTask={setSelectedTaskId}
          />
        </div>
        <FullDescriptionModal
          open={fullDescriptionOpen}
          onOpenChange={setFullDescriptionOpen}
        />
      </div>
    </ThreadErrorBoundary>
  );
}
