/**
 * MessageList - Renders the list of chat messages
 *
 * Handles message filtering, streaming task view integration,
 * and proper message rendering based on type and state.
 */

import React, { useMemo, useCallback } from "react";
import type { Message, Checkpoint } from "@langchain/langgraph-sdk";
import { DO_NOT_RENDER_ID_PREFIX } from "@/lib/utils/ensure-tool-responses";
import { AssistantMessage, AssistantMessageLoading } from "./messages/ai";
import { HumanMessage } from "./messages/human";
import { StreamingTaskView } from "./StreamingTaskView";
import { shouldRenderMessage, buildSubagentContext } from "./utils";
import type { HierarchicalTask, IntermediateLLMOutput } from "@/types/task-hierarchy";
import type { TaskProgressItem } from "@/types/task-progress";
import type { TodoLifecycleState } from "@/features/chat/hooks/useStreamingView";
import { FormSubmissionMessage } from "./schema-ui";
import type { FormState, SchemaFieldConfig } from "@/types/schema-ui";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";

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
  intermediateOutputs: IntermediateLLMOutput[];
  finalNodeId: string | null;
  finalNodeNames: string[];
  todoLifecycle: TodoLifecycleState;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  handleRegenerate: (checkpoint: Checkpoint | null | undefined) => void;
  firstTokenReceived: boolean;
  interrupt?: unknown;
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
  intermediateOutputs,
  finalNodeId,
  finalNodeNames,
  todoLifecycle,
  selectedTaskId,
  onSelectTask,
  handleRegenerate,
  firstTokenReceived,
  interrupt,
}: MessageListProps) {
  const stream = useStreamContext();

  // Build subagent context for message detection
  const subagentContext = useMemo(() => {
    return buildSubagentContext(messages);
  }, [messages]);

  // Check if there are no AI or tool messages
  const hasNoAIOrToolMessages = !messages.find(
    (m) => m.type === "ai" || m.type === "tool"
  );

  // Check if a message is from an intermediate node (not final)
  // Uses streamMetadata.langgraph_node from SDK
  const isIntermediateNodeMessage = useCallback(
    (message: Message): boolean => {
      if (message.type !== "ai") return false;

      const meta = stream.getMessagesMetadata(message);
      const nodeName = (meta?.streamMetadata as Record<string, unknown>)?.langgraph_node as string | undefined;

      // DEBUG: 실제 값 확인
      console.log("[isIntermediateNodeMessage]", {
        messageId: message.id,
        nodeName,
        finalNodeNames,
        streamMetadata: meta?.streamMetadata,
      });

      // If no node name, treat as final (main agent output)
      if (!nodeName) return false;

      // If finalNodeNames is empty, we can't determine - treat as final
      if (finalNodeNames.length === 0) return false;

      // Check if this node is in the final node list
      const isFinal = finalNodeNames.some(
        (name) => nodeName.toLowerCase() === name.toLowerCase()
      );

      console.log("[isIntermediateNodeMessage] isFinal:", isFinal);

      return !isFinal;
    },
    [stream, finalNodeNames]
  );

  // Render the message list
  const renderMessages = () => {
    const filteredMessages = messages.filter(
      (m) => !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX)
    );

    // Find last human message index
    let lastHumanIndex = -1;
    for (let i = filteredMessages.length - 1; i >= 0; i--) {
      if (filteredMessages[i].type === "human") {
        lastHumanIndex = i;
        break;
      }
    }

    // Find last AI message with text content (for compact view)
    let lastAiMessageId: string | null = null;
    if (compactView && hasVisibleContent) {
      const startIndex = lastHumanIndex >= 0 ? lastHumanIndex : -1;
      for (let i = filteredMessages.length - 1; i > startIndex; i--) {
        const msg = filteredMessages[i];
        if (msg.type === "ai") {
          const content = msg.content;
          const hasTextContent =
            typeof content === "string"
              ? content.trim().length > 0
              : Array.isArray(content) &&
                content.some(
                  (c: unknown) =>
                    typeof c === "object" &&
                    c !== null &&
                    "type" in c &&
                    (c as { type: string }).type === "text" &&
                    "text" in c &&
                    typeof (c as { text: unknown }).text === "string" &&
                    (c as { text: string }).text.trim().length > 0
                );
          if (hasTextContent) {
            lastAiMessageId = msg.id ?? null;
            break;
          }
        }
      }
    }

    const elements: React.ReactNode[] = [];

    // Insert StreamingTaskView before first message if no human messages
    // Use showTaskView (not hasVisibleContent) to show "thinking" indicator during streaming
    if (compactView && showTaskView && lastHumanIndex === -1) {
      elements.push(
        <StreamingTaskView
          key="streaming-task-view"
          progress={progress}
          activeLeafTasks={activeLeafTasks}
          isStreaming={isLoading}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          intermediateOutputs={intermediateOutputs}
          finalNodeId={finalNodeId}
        />
      );
    }

    filteredMessages.forEach((message, index) => {
      const messageKey = message.id
        ? `${message.type}-${message.id}-${index}`
        : `${message.type}-${index}`;

      if (message.type === "human") {
        elements.push(
          <HumanMessage
            key={messageKey}
            message={message}
            isLoading={isLoading}
          />
        );

        // Insert StreamingTaskView after last human message
        // Use showTaskView (not hasVisibleContent) to show "thinking" indicator during streaming
        if (compactView && showTaskView && index === lastHumanIndex) {
          elements.push(
            <StreamingTaskView
              key="streaming-task-view"
              progress={progress}
              activeLeafTasks={activeLeafTasks}
              isStreaming={isLoading}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              intermediateOutputs={intermediateOutputs}
              finalNodeId={finalNodeId}
            />
          );
        }
      } else {
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
            if (isLoading && message.id !== lastAiMessageId) {
              return;
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
              filteredMessages
            )
          ) {
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
  };

  return (
    <>
      {/* Form mode: render form submissions */}
      {isFormMode &&
        formSubmissions.map((submission, idx) => (
          <FormSubmissionMessage
            key={`form-submission-${idx}`}
            formData={submission.data}
            fields={submission.fields}
            timestamp={submission.timestamp}
          />
        ))}

      {renderMessages()}

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

      {/* Loading indicator */}
      {isLoading && !firstTokenReceived && <AssistantMessageLoading />}
    </>
  );
}
