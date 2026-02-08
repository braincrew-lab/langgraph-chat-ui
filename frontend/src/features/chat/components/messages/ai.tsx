import { useMemo, useRef, memo } from "react";
import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../content/MarkdownText";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { ToolCalls, ToolResult } from "./ToolCalls";
import { ToolCardList } from "../ToolCard";
import { isNewTaskUIEnabled } from "@/types/task-progress";
import { MessageContentComplex } from "@langchain/core/messages";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { GenericInterruptView } from "./GenericInterrupt";
import { useArtifact } from "../Artifact";

function CustomComponent({
  message,
  thread,
}: {
  message: Message;
  thread: ReturnType<typeof useStreamContext>;
}) {
  const artifact = useArtifact();
  const { values } = useStreamContext();
  const customComponents = values.ui?.filter(
    (ui) => ui.metadata?.message_id === message.id,
  );

  if (!customComponents?.length) return null;
  return (
    <Fragment key={message.id}>
      {customComponents.map((customComponent) => (
        <LoadExternalComponent
          key={customComponent.id}
          stream={thread}
          message={customComponent}
          meta={{ ui: customComponent, artifact }}
        />
      ))}
    </Fragment>
  );
}

interface ToolUseContent {
  type: "tool_use";
  id: string;
  name?: string;
  input?: string | object;
}

function isToolUseContent(
  content: MessageContentComplex,
): content is ToolUseContent {
  return content.type === "tool_use" && "id" in content;
}

function parseAnthropicStreamedToolCalls(
  content: MessageContentComplex[],
): AIMessage["tool_calls"] {
  const toolCallContents = content.filter(isToolUseContent);

  return toolCallContents.map((tc) => {
    let args: Record<string, unknown> = {};
    if (tc.input) {
      try {
        const parsedInput =
          typeof tc.input === "string" ? parsePartialJson(tc.input) : tc.input;
        args = parsedInput ?? {};
      } catch {
        // Pass
      }
    }
    return {
      name: tc.name ?? "",
      id: tc.id,
      args,
      type: "tool_call" as const,
    };
  });
}

interface InterruptProps {
  interruptValue?: unknown;
  isLastMessage: boolean;
  hasNoAIOrToolMessages: boolean;
}

function Interrupt({
  interruptValue,
  isLastMessage,
  hasNoAIOrToolMessages,
}: InterruptProps) {
  return (
    <>
      {isAgentInboxInterruptSchema(interruptValue) &&
        (isLastMessage || hasNoAIOrToolMessages) && (
          <ThreadView interrupt={interruptValue} />
        )}
      {interruptValue &&
      !isAgentInboxInterruptSchema(interruptValue) &&
      (isLastMessage || hasNoAIOrToolMessages) ? (
        <GenericInterruptView
          interrupt={
            interruptValue as
              | Record<string, unknown>
              | Record<string, unknown>[]
          }
        />
      ) : null}
    </>
  );
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
  isLoading,
  handleRegenerate,
  compactView = false,
}: {
  message: Message | undefined;
  isLoading: boolean;
  handleRegenerate: (parentCheckpoint: Checkpoint | null | undefined) => void;
  compactView?: boolean;
}) {
  const mountTime = useRef(new Date());
  const content = useMemo(() => message?.content ?? [], [message?.content]);
  const contentString = getContentString(content);
  const thread = useStreamContext();
  const isLastMessage =
    thread.messages.length > 0 &&
    thread.messages[thread.messages.length - 1]?.id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.some(
    (m: { type: string }) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;
  const nodeName = (meta?.streamMetadata as Record<string, unknown>)
    ?.langgraph_node as string | undefined;
  // Show node label in non-compact view when message comes from a named node
  const showNodeLabel = !compactView && !!nodeName && message?.type === "ai";

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = useMemo(
    () =>
      Array.isArray(content)
        ? parseAnthropicStreamedToolCalls(content)
        : undefined,
    [content],
  );

  // Task/TodoWrite 도구는 TODO 박스에서 통합 표시하므로 필터링
  const filterIntegratedTools = (toolCalls: AIMessage["tool_calls"]) => {
    return toolCalls?.filter((tc) => {
      const name = tc.name?.toLowerCase() || "";
      return name !== "task" && !name.includes("todo");
    });
  };

  const filteredToolCalls = filterIntegratedTools(
    message && "tool_calls" in message ? message.tool_calls : undefined,
  );
  const filteredAnthropicToolCalls = filterIntegratedTools(
    anthropicStreamedToolCalls,
  );

  const hasToolCalls = filteredToolCalls && filteredToolCalls.length > 0;
  const toolCallsHaveContents =
    hasToolCalls &&
    filteredToolCalls?.some((tc) => tc.args && Object.keys(tc.args).length > 0);
  const hasAnthropicToolCalls = !!filteredAnthropicToolCalls?.length;
  const isToolResult = message?.type === "tool";

  // compactView일 때 tool 메시지 숨김
  if (isToolResult && compactView) {
    return null;
  }

  // Task/TodoWrite 도구 결과는 TODO 박스에서 통합 표시하므로 여기서 숨김
  const toolName = message?.name?.toLowerCase() || "";
  const isIntegratedTool = toolName === "task" || toolName.includes("todo");
  if (isToolResult && isIntegratedTool) {
    return null;
  }

  // 빈 메시지 체크: 내용, 도구 호출, 인터럽트가 모두 없으면 렌더링하지 않음
  const hasInterrupt =
    threadInterrupt?.value && (isLastMessage || hasNoAIOrToolMessages);
  const hasContent = contentString.length > 0;
  const hasVisibleToolCalls =
    !compactView && (hasToolCalls || hasAnthropicToolCalls);

  // During streaming, show loading indicator for last message even without content
  const isStreamingEmptyMessage = isLoading && isLastMessage && !hasContent;

  if (
    !isToolResult &&
    !hasContent &&
    !hasVisibleToolCalls &&
    !hasInterrupt &&
    !isStreamingEmptyMessage
  ) {
    return null;
  }

  return (
    <div className="group flex w-full items-start gap-3">
      <div className="flex w-full min-w-0 flex-col gap-4">
        {isToolResult ? (
          <>
            <ToolResult
              message={message}
              isLoading={isLoading}
            />
            <Interrupt
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
          </>
        ) : (
          <>
            {contentString.length > 0 ? (
              <div className="min-w-0 overflow-hidden py-1 leading-relaxed">
                {showNodeLabel && (
                  <span className="text-muted-foreground mb-2 block text-sm font-semibold">
                    {nodeName}
                  </span>
                )}
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            ) : isStreamingEmptyMessage ? (
              // Show typing indicator for streaming empty message
              <div className="py-1">
                <div className="bg-muted border-border/20 inline-flex items-center gap-1.5 rounded-2xl border px-4 py-2 shadow-sm">
                  <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
                  <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
                  <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
                </div>
              </div>
            ) : null}

            {!compactView && (
              <>
                {isNewTaskUIEnabled() ? (
                  // New ToolCard UI
                  <>
                    {hasToolCalls && filteredToolCalls && (
                      <ToolCardList
                        tools={filteredToolCalls.map((tc) => ({
                          id: tc.id || `tool-${tc.name}`,
                          name: tc.name || "Unknown",
                          args: tc.args as Record<string, unknown>,
                          status: "completed" as const,
                          toolCallId: tc.id,
                        }))}
                        variant="full"
                        onRetry={() => handleRegenerate(parentCheckpoint)}
                      />
                    )}
                    {!hasToolCalls &&
                      hasAnthropicToolCalls &&
                      filteredAnthropicToolCalls && (
                        <ToolCardList
                          tools={filteredAnthropicToolCalls.map((tc) => ({
                            id: tc.id || `tool-${tc.name}`,
                            name: tc.name || "Unknown",
                            args: tc.args as Record<string, unknown>,
                            status: "completed" as const,
                            toolCallId: tc.id,
                          }))}
                          variant="full"
                          onRetry={() => handleRegenerate(parentCheckpoint)}
                        />
                      )}
                  </>
                ) : (
                  // Original ToolCalls UI
                  <>
                    {(hasToolCalls && toolCallsHaveContents && (
                      <ToolCalls
                        toolCalls={filteredToolCalls}
                        isLoading={isLoading}
                      />
                    )) ||
                      (hasAnthropicToolCalls && (
                        <ToolCalls
                          toolCalls={filteredAnthropicToolCalls}
                          isLoading={isLoading}
                        />
                      )) ||
                      (hasToolCalls && (
                        <ToolCalls
                          toolCalls={filteredToolCalls}
                          isLoading={isLoading}
                        />
                      ))}
                  </>
                )}
              </>
            )}

            {message && (
              <CustomComponent
                message={message}
                thread={thread}
              />
            )}
            <Interrupt
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
            <div className="mr-auto flex items-center gap-2">
              <span className="text-muted-foreground/40 text-sm font-medium tabular-nums">
                {mountTime.current.toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}{" "}
                {mountTime.current.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <BranchSwitcher
                branch={meta?.branch}
                branchOptions={meta?.branchOptions}
                onSelect={(branch) => thread.setBranch(branch)}
                isLoading={isLoading}
              />
              <CommandBar
                content={contentString}
                isLoading={isLoading}
                isAiMessage={true}
                handleRegenerate={() => handleRegenerate(parentCheckpoint)}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export function AssistantMessageLoading() {
  return (
    <div className="flex w-full items-start gap-3">
      <div className="bg-muted border-border/20 flex h-9 items-center gap-1.5 rounded-2xl border px-5 py-2.5 shadow-sm">
        <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
        <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
        <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
      </div>
    </div>
  );
}
