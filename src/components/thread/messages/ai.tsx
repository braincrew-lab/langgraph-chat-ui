import { parsePartialJson } from "@langchain/core/output_parsers";
import { useStreamContext } from "@/hooks/useStreamContext";
import { AIMessage, Checkpoint, Message } from "@langchain/langgraph-sdk";
import { getContentString } from "../utils";
import { BranchSwitcher, CommandBar } from "./shared";
import { MarkdownText } from "../markdown-text";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { cn } from "@/lib/utils";
import { ToolCalls, ToolResult } from "./tool-calls";
import { MessageContentComplex } from "@langchain/core/messages";
import { Fragment } from "react/jsx-runtime";
import { isAgentInboxInterruptSchema } from "@/lib/agent-inbox-interrupt";
import { ThreadView } from "../agent-inbox";
import { useQueryState, parseAsBoolean } from "nuqs";
import { GenericInterruptView } from "./generic-interrupt";
import { useArtifact } from "../artifact";

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

function isToolUseContent(content: MessageContentComplex): content is ToolUseContent {
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
        const parsedInput = typeof tc.input === "string"
          ? parsePartialJson(tc.input)
          : tc.input;
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
        <GenericInterruptView interrupt={interruptValue as Record<string, unknown> | Record<string, unknown>[]} />
      ) : null}
    </>
  );
}

export function AssistantMessage({
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
  const content = message?.content ?? [];
  const contentString = getContentString(content);
  const [hideToolCalls] = useQueryState(
    "hideToolCalls",
    parseAsBoolean.withDefault(false),
  );

  const thread = useStreamContext();
  const isLastMessage =
    thread.messages[thread.messages.length - 1].id === message?.id;
  const hasNoAIOrToolMessages = !thread.messages.find(
    (m) => m.type === "ai" || m.type === "tool",
  );
  const meta = message ? thread.getMessagesMetadata(message) : undefined;
  const threadInterrupt = thread.interrupt;

  const parentCheckpoint = meta?.firstSeenState?.parent_checkpoint;
  const anthropicStreamedToolCalls = Array.isArray(content)
    ? parseAnthropicStreamedToolCalls(content)
    : undefined;

  // Task/TodoWrite 도구는 TODO 박스에서 통합 표시하므로 필터링
  const filterIntegratedTools = (toolCalls: AIMessage["tool_calls"]) => {
    return toolCalls?.filter(tc => {
      const name = tc.name?.toLowerCase() || "";
      return name !== "task" && !name.includes("todo");
    });
  };

  const filteredToolCalls = filterIntegratedTools(message && "tool_calls" in message ? message.tool_calls : undefined);
  const filteredAnthropicToolCalls = filterIntegratedTools(anthropicStreamedToolCalls);

  const hasToolCalls = filteredToolCalls && filteredToolCalls.length > 0;
  const toolCallsHaveContents =
    hasToolCalls &&
    filteredToolCalls?.some(
      (tc) => tc.args && Object.keys(tc.args).length > 0,
    );
  const hasAnthropicToolCalls = !!filteredAnthropicToolCalls?.length;
  const isToolResult = message?.type === "tool";

  // compactView 또는 hideToolCalls일 때 tool 메시지 숨김
  if (isToolResult && (hideToolCalls || compactView)) {
    return null;
  }

  // Task/TodoWrite 도구 결과는 TODO 박스에서 통합 표시하므로 여기서 숨김
  const toolName = message?.name?.toLowerCase() || "";
  const isIntegratedTool = toolName === "task" || toolName.includes("todo");
  if (isToolResult && isIntegratedTool) {
    return null;
  }

  return (
    <div className="group mr-auto flex items-start gap-3">
      <div className="flex flex-col gap-3">
        {isToolResult ? (
          <>
            <ToolResult message={message} isLoading={isLoading} />
            <Interrupt
              interruptValue={threadInterrupt?.value}
              isLastMessage={isLastMessage}
              hasNoAIOrToolMessages={hasNoAIOrToolMessages}
            />
          </>
        ) : (
          <>
            {contentString.length > 0 && (
              <div className="py-1 leading-relaxed">
                <MarkdownText>{contentString}</MarkdownText>
              </div>
            )}

            {!hideToolCalls && !compactView && (
              <>
                {(hasToolCalls && toolCallsHaveContents && (
                  <ToolCalls toolCalls={filteredToolCalls} isLoading={isLoading} />
                )) ||
                  (hasAnthropicToolCalls && (
                    <ToolCalls toolCalls={filteredAnthropicToolCalls} isLoading={isLoading} />
                  )) ||
                  (hasToolCalls && (
                    <ToolCalls toolCalls={filteredToolCalls} isLoading={isLoading} />
                  ))}
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
            <div
              className={cn(
                "mr-auto flex items-center gap-2 transition-opacity",
                "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
              )}
            >
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
}

export function AssistantMessageLoading() {
  return (
    <div className="mr-auto flex items-start gap-3">
      <div className="bg-muted flex h-9 items-center gap-1.5 rounded-2xl px-5 py-2.5 shadow-sm border border-border/20">
        <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_infinite] rounded-full"></div>
        <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_0.5s_infinite] rounded-full"></div>
        <div className="bg-foreground/40 h-1.5 w-1.5 animate-[pulse_1.5s_ease-in-out_1s_infinite] rounded-full"></div>
      </div>
    </div>
  );
}
