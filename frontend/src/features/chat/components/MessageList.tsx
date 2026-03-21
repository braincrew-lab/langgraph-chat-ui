/**
 * MessageList - Renders the list of chat messages
 *
 * Handles message filtering, streaming task view integration,
 * and proper message rendering based on type and state.
 */

import React, { useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { Message, Checkpoint } from "@langchain/langgraph-sdk";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/utils/ensure-tool-responses";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import { StreamingTaskView } from "./StreamingTaskView";
import { shouldRenderMessage, buildSubagentContext } from "./utils";
import type { HierarchicalTask } from "@/types/task-hierarchy";
import type { TaskProgressItem, ActivityItem } from "@/types/task-progress";
import type { TodoLifecycleState } from "@/features/chat/hooks/useStreamingView";
import { FormSubmissionMessage } from "./schema-ui";
import type { FormState, SchemaFieldConfig } from "@/types/schema-ui";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { LoaderCircle } from "lucide-react";
import { StreamErrorMessage } from "./streaming/StreamErrorMessage";

function hasAiTextContent(msg: Message): boolean {
  const content = msg.content;
  if (typeof content === "string") return content.trim().length > 0;
  return (
    Array.isArray(content) &&
    content.some(
      (c: unknown) =>
        typeof c === "object" &&
        c !== null &&
        "type" in c &&
        (c as { type: string }).type === "text" &&
        "text" in c &&
        typeof (c as { text: unknown }).text === "string" &&
        (c as { text: string }).text.trim().length > 0,
    )
  );
}

interface FormSubmission {
  data: FormState;
  fields: SchemaFieldConfig[];
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  isFormMode: boolean;
  formSubmissions: FormSubmission[];
  compactView: boolean;
  hasVisibleContent: boolean;
  showTaskView: boolean;
  progress: TaskProgressItem[];
  activeLeafTasks: HierarchicalTask[];
  activityItems: ActivityItem[];
  finalNodeNames: string[];
  todoLifecycle: TodoLifecycleState;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  handleRegenerate: (checkpoint: Checkpoint | null | undefined) => void;
  firstTokenReceived: boolean;
  interrupt?: unknown;
  /** Thread ID - when set, indicates we're on a chat detail page */
  threadId?: string | null;
  /** Whether conversation history is currently loading */
  isHistoryLoading?: boolean;
  /** Stream error - when set, displays error message instead of task view */
  streamError?: unknown;
  /** Callback to retry the last message */
  onRetry?: () => void;
}

export function MessageList({
  messages,
  isLoading,
  isFormMode,
  formSubmissions,
  compactView,
  hasVisibleContent,
  showTaskView,
  progress,
  activeLeafTasks,
  activityItems,
  finalNodeNames,
  todoLifecycle,
  selectedTaskId,
  onSelectTask,
  handleRegenerate,
  firstTokenReceived,
  interrupt,
  threadId,
  isHistoryLoading = false,
  streamError,
  onRetry,
}: MessageListProps) {
  const t = useTranslations("chat");
  const stream = useStreamContext();

  const filteredSubmissions = useMemo(() => {
    return formSubmissions.flatMap((submission) => {
      const fields = isFormMode
        ? submission.fields
        : submission.fields.filter((field) => {
            if (!field.name.toLowerCase().includes("file")) return false;
            const value = submission.data[field.name];
            return Array.isArray(value) ? value.length > 0 : !!value;
          });

      if (fields.length === 0) {
        return [];
      }

      return [{ ...submission, fields }];
    });
  }, [formSubmissions, isFormMode]);

  // Build subagent context for message detection
  const subagentContext = useMemo(() => {
    return buildSubagentContext(messages);
  }, [messages]);

  // Check if there are no AI or tool messages
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );

  // Check if a message is from an intermediate node (not final)
  // Uses streamMetadata.langgraph_node from SDK
  const isIntermediateNodeMessage = useCallback(
    (message: Message): boolean => {
      if (message.type !== "ai") return false;

      const meta = stream.getMessagesMetadata(message);
      const nodeName = (meta?.streamMetadata as Record<string, unknown>)
        ?.langgraph_node as string | undefined;

      // If no node name, treat as final (main agent output)
      if (!nodeName) return false;

      // If finalNodeNames is empty, we can't determine - treat as final
      if (finalNodeNames.length === 0) return false;

      // Check if this node is in the final node list
      const isFinal = finalNodeNames.some(
        (name) => nodeName.toLowerCase() === name.toLowerCase(),
      );

      return !isFinal;
    },
    [stream, finalNodeNames],
  );

  // Render the message list
  const renderMessages = () => {
    const filteredMessages = messages.filter(
      (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX),
    );

    // Collect all human message indices
    const humanIndices: number[] = [];
    for (let i = 0; i < filteredMessages.length; i++) {
      if (filteredMessages[i].type === "human") humanIndices.push(i);
    }
    const lastHumanIndex =
      humanIndices.length > 0 ? humanIndices[humanIndices.length - 1] : -1;

    // Collect final AI message IDs for completed turns (all turns except the last)
    const completedTurnFinalAiIds = new Set<string>();
    if (compactView) {
      for (let t = 0; t < humanIndices.length - 1; t++) {
        const turnStart = humanIndices[t];
        const turnEnd = humanIndices[t + 1];
        for (let i = turnEnd - 1; i > turnStart; i--) {
          const msg = filteredMessages[i];
          if (
            msg.type === "ai" &&
            !subagentContext.subagentMessageIds.has(msg.id || "") &&
            !isIntermediateNodeMessage(msg) &&
            hasAiTextContent(msg) &&
            msg.id
          ) {
            completedTurnFinalAiIds.add(msg.id);
            break;
          }
        }
      }
    }

    // Find last AI message with text content (for compact view)
    // Also find last AI message index for streaming cases
    let lastAiMessageId: string | null = null;
    let lastAiMessageIndex: number = -1;

    if (compactView && (hasVisibleContent || isLoading)) {
      const startIndex = lastHumanIndex >= 0 ? lastHumanIndex : -1;
      for (let i = filteredMessages.length - 1; i > startIndex; i--) {
        const msg = filteredMessages[i];
        if (msg.type === "ai") {
          // Track last AI message index for streaming (even without content)
          if (lastAiMessageIndex === -1) {
            lastAiMessageIndex = i;
          }

          if (hasAiTextContent(msg)) {
            lastAiMessageId = msg.id ?? null;
            break;
          }
        }
      }
    }

    const elements: React.ReactNode[] = [];

    // Insert StreamingTaskView or StreamErrorMessage before first message if no human messages
    // Use showTaskView (not hasVisibleContent) to show "thinking" indicator during streaming
    if (compactView && lastHumanIndex === -1) {
      if (streamError) {
        // Show error message instead of task view when error occurs
        elements.push(
          <StreamErrorMessage
            key="stream-error"
            error={streamError}
            onRetry={onRetry}
          />,
        );
      } else if (showTaskView) {
        elements.push(
          <StreamingTaskView
            key="streaming-task-view"
            progress={progress}
            activeLeafTasks={activeLeafTasks}
            isStreaming={isLoading}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            activityItems={activityItems}
          />,
        );
      }
    }

    filteredMessages.forEach((message, index) => {
      const messageKey = message.id
        ? `${message.type}-${message.id}-${index}`
        : `${message.type}-${index}`;

      if (message.type === "human") {
        // Named human messages (e.g. HumanMessage(name="critic")) are agent-generated,
        // not actual user input — hide in compact view
        const isAgentHumanMessage = !!message.name && message.name.length > 0;
        if (compactView && isAgentHumanMessage) {
          return;
        }

        elements.push(
          <HumanMessage
            key={messageKey}
            message={message}
            isLoading={isLoading}
          />,
        );

        // Insert StreamingTaskView or StreamErrorMessage after last human message
        // Use showTaskView (not hasVisibleContent) to show "thinking" indicator during streaming
        if (compactView && index === lastHumanIndex) {
          if (streamError) {
            // Show error message instead of task view when error occurs
            elements.push(
              <StreamErrorMessage
                key="stream-error"
                error={streamError}
                onRetry={onRetry}
              />,
            );
          } else if (showTaskView) {
            elements.push(
              <StreamingTaskView
                key="streaming-task-view"
                progress={progress}
                activeLeafTasks={activeLeafTasks}
                isStreaming={isLoading}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                activityItems={activityItems}
              />,
            );
          }
        }
      } else {
        // Determine which turn this message belongs to
        const owningHumanIdx = (() => {
          for (let t = humanIndices.length - 1; t >= 0; t--) {
            if (humanIndices[t] < index) return t;
          }
          return -1;
        })();
        const isInCompletedTurn =
          owningHumanIdx >= 0 && owningHumanIdx < humanIndices.length - 1;

        if (compactView && isInCompletedTurn) {
          // Completed turn: hide tool, subagent, intermediate; show only final AI
          if (message.type === "tool") return;
          if (message.type === "ai") {
            if (subagentContext.subagentMessageIds.has(message.id || ""))
              return;
            if (isIntermediateNodeMessage(message)) return;
            if (!completedTurnFinalAiIds.has(message.id || "")) return;
          }
        } else {
          // Current turn (or pre-turn messages): existing logic
          const isAfterLastHuman =
            lastHumanIndex >= 0 && index > lastHumanIndex;
          // Apply compact filter during streaming (isLoading) OR when there's visible content
          // This ensures intermediate node outputs are hidden even before hasVisibleContent becomes true
          const shouldApplyCompactFilter =
            compactView &&
            (hasVisibleContent || isLoading) &&
            (isAfterLastHuman || lastHumanIndex === -1);

          if (shouldApplyCompactFilter) {
            if (message.type === "tool") {
              return;
            }
            if (message.type === "ai") {
              // 서브에이전트 메시지는 항상 숨김
              if (subagentContext.subagentMessageIds.has(message.id || "")) {
                return;
              }
              // 중간 노드 메시지는 숨김 (Task Viewer에서 표시)
              if (isIntermediateNodeMessage(message)) {
                return;
              }
              // 스트리밍 중에는 마지막 AI 메시지만 표시
              // Use lastAiMessageId if found, otherwise use lastAiMessageIndex
              if (isLoading) {
                const isLastAiMessage = lastAiMessageId
                  ? message.id === lastAiMessageId
                  : index === lastAiMessageIndex;
                if (!isLastAiMessage) {
                  return;
                }
              }
            }
          }

          if (!shouldApplyCompactFilter) {
            if (
              !shouldRenderMessage(
                message,
                todoLifecycle,
                compactView,
                false,
                subagentContext,
                filteredMessages,
              )
            ) {
              return;
            }
          }
        }

        elements.push(
          <AssistantMessage
            key={messageKey}
            message={message}
            isLoading={isLoading}
            handleRegenerate={handleRegenerate}
            compactView={compactView}
          />,
        );
      }
    });

    return elements;
  };

  // Show loading spinner when on chat detail page and no messages yet
  const showHistoryLoading =
    threadId &&
    messages.length === 0 &&
    formSubmissions.length === 0 &&
    (isHistoryLoading || !firstTokenReceived);

  return (
    <>
      {/* Loading spinner for conversation history */}
      {showHistoryLoading && (
        <div className="flex h-full w-full items-center justify-center py-12">
          <div className="text-muted-foreground flex items-center gap-3">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t("loadingConversation")}</span>
          </div>
        </div>
      )}

      {/* Form submissions (Form mode: all fields, Chat mode: file fields only) */}
      {filteredSubmissions.map((submission, idx) => (
        <FormSubmissionMessage
          key={`form-submission-${idx}`}
          formData={submission.data}
          fields={submission.fields}
          timestamp={submission.timestamp}
        />
      ))}

      {!showHistoryLoading && renderMessages()}

      {/* Show interrupt message if no AI/tool messages */}
      {hasNoAIOrToolMessages && !!interrupt && (
        <AssistantMessage
          key="interrupt-msg"
          message={undefined}
          isLoading={isLoading}
          handleRegenerate={handleRegenerate}
          compactView={compactView}
        />
      )}

      {/* Loading indicator - hide when StreamingTaskView is shown (compactView && showTaskView) */}
      {isLoading && !firstTokenReceived && !(compactView && showTaskView) && (
        <AssistantMessageLoading />
      )}
    </>
  );
}
