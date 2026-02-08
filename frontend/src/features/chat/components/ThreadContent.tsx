/**
 * ThreadContent - Chat content without sidebar
 * The sidebar is now rendered in the shared layout (MainLayoutClient)
 */

import { useEffect, useRef, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { UI, TIMING } from "@/lib/constants";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { useState } from "react";
import { useQueryState, parseAsBoolean } from "nuqs";
import { StickToBottom } from "use-stick-to-bottom";
import { toast } from "sonner";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useFileUpload } from "@/shared/hooks/useFileUpload";
import { useSettings } from "@/shared/hooks/useSettings";
import { FullDescriptionModal } from "./modals/FullDescriptionModal";
import { useAssistantConfig } from "@/shared/hooks/useAssistantConfig";
import { useSchemaUI } from "@/features/chat/hooks/useSchemaUI";
import { UnifiedInputArea } from "./schema-ui";
import { updateAssistantIdAction } from "@/app/actions";
import { MessageList } from "./MessageList";
import { TracingSidebar } from "./sidebar/TracingSidebar";
import { ThreadErrorBoundary } from "./ThreadErrorBoundary";
import { useLangSmithRuns } from "@/features/chat/hooks/useLangSmithRuns";
import { useStreamingView } from "@/features/chat/hooks/useStreamingView";
import { useMessageSubmit } from "@/features/chat/hooks/useMessageSubmit";
import { StickyToBottomContent, ScrollToBottom } from "./ScrollComponents";
import { WelcomeScreen } from "./WelcomeScreen";
import {
  mapRunToToolCallEvent,
  mapRunToToolResultEvent,
  mapRunToLLMEvent,
  mapRunToMiddlewareEvent,
} from "@/types/langsmith";
import { type LangSmithTimelineEvents } from "@/types/timeline";

export function ThreadContent() {
  const { config, userSettings, updateUserSettings, globalSettings } =
    useSettings();
  const [threadId] = useQueryState("threadId");

  // Tracing panel state
  const sidebarOpen = userSettings.tracingPanelOpen;
  const setSidebarOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === "function" ? value(sidebarOpen) : value;
      updateUserSettings({ tracingPanelOpen: newValue });
    },
    [sidebarOpen, updateUserSettings],
  );

  const [compactView, setCompactView] = useQueryState(
    "compactView",
    parseAsBoolean.withDefault(true),
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
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");

  // Schema UI for dynamic form fields
  const schemaUI = useSchemaUI();
  const { parsedSchema, getSubmitPayload, resetForm } = schemaUI;
  const isFormMode = parsedSchema.uiMode === "form";

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

  const isAssistantSelected = Boolean(currentAssistantId?.trim());

  // Message submit logic (extracted hook)
  const {
    handleSubmit,
    handleRegenerate,
    handleRetry,
    handleFormSubmit,
    firstTokenReceived,
    setFirstTokenReceived,
    formSubmissions,
  } = useMessageSubmit({
    stream,
    isAssistantSelected,
    input,
    setInput,
    contentBlocks,
    setContentBlocks,
    getSubmitPayload,
    resetForm,
    parsedSchema,
  });

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

  // Reset on threadId change (any thread switch, not just null)
  const prevThreadId = useRef(threadId);
  useEffect(() => {
    if (prevThreadId.current !== threadId) {
      // Always clear streaming state on thread switch to prevent stale indicators
      stream.clearNodeUpdates();
      setFirstTokenReceived(false);

      if (threadId === null) {
        setSidebarOpen(false);
        setInput("");
        setContentBlocks([]);
      }
    }
    prevThreadId.current = threadId;
  }, [
    threadId,
    setSidebarOpen,
    setContentBlocks,
    stream,
    setFirstTokenReceived,
  ]);

  const lastError = useRef<string | undefined>(undefined);

  const assistantSelectValue = useMemo(
    () => currentAssistantId?.trim() || "none",
    [currentAssistantId],
  );

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
    [currentAssistantId],
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

  const chatStarted =
    !!threadId || !!messages.length || formSubmissions.length > 0;

  return (
    <ThreadErrorBoundary>
      <div className="flex h-full w-full overflow-hidden">
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
          >
            <StickToBottom
              resize="smooth"
              className="relative flex-1 overflow-hidden"
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
                    ? "pt-8 pb-16 flex flex-col gap-4"
                    : "",
                  "mx-auto w-full",
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
                    threadId={threadId}
                    streamError={stream.error}
                    onRetry={handleRetry}
                  />
                }
                footer={
                  <div className="sticky bottom-0 flex flex-col items-center gap-10 bg-none">
                    {!chatStarted && (
                      <WelcomeScreen
                        config={config}
                        chatWidth={userSettings.chatWidth}
                        isFormMode={isFormMode}
                        isSchemaLoading={schemaUI.isLoading}
                        isLoading={isLoading}
                        isAssistantSelected={isAssistantSelected}
                        onSelectOpener={(opener) => {
                          setInput(opener);
                          setTimeout(() => {
                            const form = document.querySelector("form");
                            form?.requestSubmit();
                          }, 0);
                        }}
                        onFullDescriptionOpen={() =>
                          setFullDescriptionOpen(true)
                        }
                      />
                    )}

                    <ScrollToBottom className="animate-in fade-in-0 zoom-in-95 absolute bottom-full left-1/2 mb-4 -translate-x-1/2" />

                    <div
                      className={cn(
                        "relative z-10 mx-auto mb-8 w-full",
                        userSettings.chatWidth === "default"
                          ? "max-w-3xl"
                          : "max-w-5xl",
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
                        onStop={() => {
                          stream.stop();
                          stream.deactivateAllNodes();
                        }}
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
                        enableGraphSelection={
                          globalSettings["features.enableGraphSelection"]
                        }
                        enableAdvancedInput={
                          globalSettings["features.enableAdvancedInput"]
                        }
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
