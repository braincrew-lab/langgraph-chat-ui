/**
 * useStreamingOutput Hook
 *
 * Handles extraction of streaming LLM outputs from messages.
 * Supports both main agent and subagent streaming outputs.
 */

import { useMemo, useEffect, useRef } from "react";
import type { IntermediateLLMOutput } from "@/types/task-hierarchy";
import { type LangGraphMessage, type NodeUpdateInfo, getTextFromContent } from "./utils";

interface UseStreamingOutputOptions {
  messages: unknown[];
  isStreaming: boolean;
  activeTaskCallIds: Set<string>;
  nodeUpdates?: NodeUpdateInfo[];
  finalNodeNames?: string[];
  updateNodeCompletedOutput?: (nodeName: string, output: string) => void;
}

interface UseStreamingOutputReturn {
  /** Main agent streaming LLM output */
  streamingLLMOutput: string | null;
  /** Per-subagent streaming outputs */
  subagentStreamingOutputs: Map<string, string>;
  /** Intermediate node outputs for compact view */
  intermediateOutputs: IntermediateLLMOutput[];
  /** Final node ID ("main" or subagent toolCallId) */
  finalNodeId: string | null;
  /** Current active node name */
  currentActiveNode: string | null;
}

/**
 * Extract streaming main agent LLM output (excluding subagent messages)
 */
function extractStreamingLLMOutput(
  messages: unknown[],
  isStreaming: boolean,
  activeTaskCallIds?: Set<string>
): string | null {
  if (!isStreaming) return null;

  const taskScopes: Array<{ startIndex: number; taskId: string }> = [];
  const completedTaskIds = new Set<string>();

  for (const msg of messages) {
    const m = msg as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.name?.toLowerCase() === "task" && m.tool_call_id) {
      completedTaskIds.add(m.tool_call_id);
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id) {
          const isActive = activeTaskCallIds ? activeTaskCallIds.has(tc.id) : !completedTaskIds.has(tc.id);
          if (isActive) {
            taskScopes.push({ startIndex: i, taskId: tc.id });
          }
        }
      }
    }
  }

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type !== "ai" || !msg.content) continue;

    const isInTaskScope = taskScopes.some((scope) => i > scope.startIndex);

    if (isInTaskScope) {
      const hasMainAgentCall = msg.tool_calls?.some(
        (tc) => tc.name?.toLowerCase() === "task" || tc.name?.toLowerCase().includes("todo")
      );
      if (!hasMainAgentCall) continue;
    }

    const text = getTextFromContent(msg.content);
    if (text.trim().length > 0) return text;
  }

  return null;
}

/**
 * Extract streaming output for each active Task (parallel subagent support)
 */
function extractSubagentStreamingOutput(
  messages: unknown[],
  isStreaming: boolean,
  activeTaskCallIds?: Set<string>
): Map<string, string> {
  const outputs = new Map<string, string>();

  if (!isStreaming || !activeTaskCallIds || activeTaskCallIds.size === 0) {
    return outputs;
  }

  interface TaskScope {
    taskId: string;
    startIndex: number;
    endIndex: number;
  }

  const taskScopes: TaskScope[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as LangGraphMessage;
    if (msg.type === "ai" && Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        if (tc.name?.toLowerCase() === "task" && tc.id && activeTaskCallIds.has(tc.id)) {
          taskScopes.push({ taskId: tc.id, startIndex: i, endIndex: messages.length });
        }
      }
    }
  }

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i] as { type?: string; tool_call_id?: string; name?: string };
    if (msg.type === "tool" && msg.name?.toLowerCase() === "task" && msg.tool_call_id) {
      const scope = taskScopes.find((s) => s.taskId === msg.tool_call_id);
      if (scope) scope.endIndex = i;
    }
  }

  for (const scope of taskScopes) {
    for (let i = scope.endIndex - 1; i > scope.startIndex; i--) {
      const msg = messages[i] as LangGraphMessage;
      if (msg.type !== "ai" || !msg.content) continue;

      const hasMainAgentCall = msg.tool_calls?.some(
        (tc) => tc.name?.toLowerCase() === "task" || tc.name?.toLowerCase().includes("todo")
      );
      if (hasMainAgentCall) continue;

      const text = getTextFromContent(msg.content);
      if (text.trim().length > 0) {
        outputs.set(scope.taskId, text);
        break;
      }
    }
  }

  return outputs;
}

/**
 * Hook for extracting streaming LLM outputs
 */
export function useStreamingOutput(options: UseStreamingOutputOptions): UseStreamingOutputReturn {
  const {
    messages,
    isStreaming,
    activeTaskCallIds,
    nodeUpdates,
    finalNodeNames = [],
    updateNodeCompletedOutput,
  } = options;

  // Extract main agent streaming output
  const streamingLLMOutput = useMemo(() => {
    return extractStreamingLLMOutput(messages, isStreaming, activeTaskCallIds);
  }, [messages, isStreaming, activeTaskCallIds]);

  // Extract per-subagent streaming outputs
  const subagentStreamingOutputs = useMemo(() => {
    return extractSubagentStreamingOutput(messages, isStreaming, activeTaskCallIds);
  }, [messages, isStreaming, activeTaskCallIds]);

  // Current active node name
  const currentActiveNode = useMemo(() => {
    return nodeUpdates?.find((n) => n.isActive)?.nodeName ?? null;
  }, [nodeUpdates]);

  // Track previous active node for completed output storage
  const prevActiveNodeRef = useRef<string | null>(null);
  const prevStreamingOutputRef = useRef<string | null>(null);

  // Store completed output when node changes
  useEffect(() => {
    const prevNode = prevActiveNodeRef.current;
    const prevOutput = prevStreamingOutputRef.current;

    if (prevNode && prevNode !== currentActiveNode && updateNodeCompletedOutput) {
      updateNodeCompletedOutput(prevNode, prevOutput ?? "");
    }

    prevActiveNodeRef.current = currentActiveNode;
    prevStreamingOutputRef.current = streamingLLMOutput;
  }, [currentActiveNode, streamingLLMOutput, updateNodeCompletedOutput]);

  // Store final output when streaming ends
  useEffect(() => {
    if (!isStreaming && prevActiveNodeRef.current && updateNodeCompletedOutput) {
      updateNodeCompletedOutput(prevActiveNodeRef.current, prevStreamingOutputRef.current ?? "");
    }
  }, [isStreaming, updateNodeCompletedOutput]);

  // Calculate intermediate outputs and final node ID
  const { intermediateOutputs, finalNodeId } = useMemo((): {
    intermediateOutputs: IntermediateLLMOutput[];
    finalNodeId: string | null;
  } => {
    const outputs: IntermediateLLMOutput[] = [];
    const hasActiveSubagents = activeTaskCallIds.size > 0 && subagentStreamingOutputs.size > 0;

    // Task tool-based subagents
    if (hasActiveSubagents || subagentStreamingOutputs.size > 0) {
      let latestActiveTaskId: string | null = null;
      let latestTimestamp = 0;

      for (const [taskId, output] of subagentStreamingOutputs) {
        const isActive = activeTaskCallIds.has(taskId);
        const timestamp = Date.now();

        if (isActive && output.length > 0) {
          if (output.length > latestTimestamp) {
            latestTimestamp = output.length;
            latestActiveTaskId = taskId;
          }
        }

        outputs.push({
          nodeId: taskId,
          nodeName: `Task ${taskId.slice(0, 8)}...`,
          outputSnippet: output.length > 100 ? output.slice(0, 100) + "..." : output,
          fullOutput: output,
          status: isActive ? "streaming" : "completed",
          timestamp,
          isFinal: false,
        });
      }

      if (streamingLLMOutput) {
        outputs.unshift({
          nodeId: "main",
          nodeName: "Main Agent",
          outputSnippet: streamingLLMOutput.length > 100 ? streamingLLMOutput.slice(0, 100) + "..." : streamingLLMOutput,
          fullOutput: streamingLLMOutput,
          status: "streaming",
          timestamp: Date.now(),
          isFinal: !hasActiveSubagents,
        });
      }

      const finalId = hasActiveSubagents ? latestActiveTaskId : streamingLLMOutput ? "main" : null;
      for (const output of outputs) {
        output.isFinal = output.nodeId === finalId;
      }

      return { intermediateOutputs: outputs, finalNodeId: finalId };
    }

    // SSE event-based nodes
    if (nodeUpdates && nodeUpdates.length > 0) {
      const sortedNodes = nodeUpdates.slice().sort((a, b) => a.timestamp - b.timestamp);

      if (sortedNodes.length > 0) {
        const activeNode = sortedNodes.find((u) => u.isActive);

        for (const nodeUpdate of sortedNodes) {
          const isActiveNode = nodeUpdate === activeNode;

          const nodeId =
            nodeUpdate.namespace.length > 0
              ? `${nodeUpdate.namespace.join(":")}:${nodeUpdate.nodeName}`
              : nodeUpdate.nodeName;

          const isMainGraphNode = nodeUpdate.namespace.length === 0;
          const isGraphFinalNode = isMainGraphNode && finalNodeNames.includes(nodeUpdate.nodeName);

          const outputText = isActiveNode ? streamingLLMOutput || "" : nodeUpdate.completedOutput || "";
          const snippet = outputText.length > 100 ? outputText.slice(0, 100) + "..." : outputText;

          outputs.push({
            nodeId,
            nodeName: nodeUpdate.nodeName,
            outputSnippet: snippet || (isActiveNode ? "Generating..." : "Completed"),
            fullOutput: outputText,
            status: isActiveNode ? "streaming" : "completed",
            timestamp: nodeUpdate.timestamp,
            isFinal: isGraphFinalNode,
          });
        }

        const finalId = outputs.find((o) => o.isFinal)?.nodeId ?? null;
        return { intermediateOutputs: outputs, finalNodeId: finalId };
      }
    }

    // Single node streaming
    if (isStreaming && streamingLLMOutput) {
      const snippet = streamingLLMOutput.length > 100 ? streamingLLMOutput.slice(0, 100) + "..." : streamingLLMOutput;
      outputs.push({
        nodeId: "main",
        nodeName: "Agent",
        outputSnippet: snippet,
        fullOutput: streamingLLMOutput,
        status: "streaming",
        timestamp: Date.now(),
        isFinal: false,
      });
      return { intermediateOutputs: outputs, finalNodeId: "main" };
    }

    return { intermediateOutputs: [], finalNodeId: null };
  }, [streamingLLMOutput, subagentStreamingOutputs, activeTaskCallIds, isStreaming, nodeUpdates, finalNodeNames]);

  return {
    streamingLLMOutput,
    subagentStreamingOutputs,
    intermediateOutputs,
    finalNodeId,
    currentActiveNode,
  };
}
