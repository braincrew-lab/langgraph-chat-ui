/**
 * useStreamingView - Streaming View State Management Hook
 *
 * Provides unified state for displaying streaming task progress with TODO items,
 * tool calls, and LangSmith integration.
 *
 * Simplified implementation using flat list with grouping (no hierarchical nesting).
 */

import { useMemo } from "react";
import type { Message } from "@langchain/langgraph-sdk";
import type { LangSmithRun } from "@/types/langsmith";
import { buildTaskHierarchy, findActiveLeafTasks } from "@/types/langsmith";
import type { HierarchicalTask, IntermediateLLMOutput } from "@/types/task-hierarchy";
import type { TaskProgressItem } from "@/types/task-progress";
import { useTaskProgress } from "./useTaskProgress";
import { useLangSmithEnrichment } from "./useLangSmithEnrichment";
import type { NodeUpdateInfo } from "./utils";

// Re-export types for consumers
export type { TaskProgressItem };
export type TodoLifecycleState = "inactive" | "active" | "all_completed";

// Type for message metadata from SDK
interface MessageMetadata {
  streamMetadata?: {
    langgraph_node?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface UseStreamingViewOptions {
  defaultShowCompletedDetails?: boolean;
  defaultExpandDepth?: number;
  nodeUpdates?: NodeUpdateInfo[];
  finalNodeNames?: string[];
  updateNodeCompletedOutput?: (nodeName: string, output: string) => void;
  /** Function to get message metadata (for extracting langgraph_node) */
  getMessagesMetadata?: (message: Message) => MessageMetadata | undefined;
  /** Map of message index → node name (from Stream context) */
  messageNodeMap?: Map<number, string>;
}

interface UseStreamingViewReturn {
  /** Enriched progress items (flat list with grouping) */
  progress: TaskProgressItem[];

  /** TODO lifecycle state */
  todoLifecycle: TodoLifecycleState;

  /** Whether there's actual task/todo content (for compact filtering) */
  hasVisibleContent: boolean;

  /** Whether to show the task view (includes streaming "thinking" state) */
  showTaskView: boolean;

  /** Active leaf tasks from LangSmith */
  activeLeafTasks: HierarchicalTask[];

  /** Intermediate outputs for display */
  intermediateOutputs: IntermediateLLMOutput[];

  /** Final node ID */
  finalNodeId: string | null;
}

export function useStreamingView(
  runs: LangSmithRun[],
  isStreaming: boolean,
  messages: unknown[] = [],
  options: UseStreamingViewOptions = {}
): UseStreamingViewReturn {
  const { nodeUpdates, finalNodeNames = [], messageNodeMap } = options;

  const typedMessages = messages as Message[];

  // ========================================
  // Task Progress Extraction (Messages)
  // ========================================

  const {
    progress: baseProgress,
    hasContent,
    lifecycle,
  } = useTaskProgress({
    messages,
    nodeUpdates,
    isStreaming,
    finalNodeNames,
  });

  // ========================================
  // LangSmith Enrichment
  // ========================================

  const { enrichedProgress } = useLangSmithEnrichment({
    progress: baseProgress,
    runs,
    isLoading: isStreaming,
  });

  // ========================================
  // LangSmith Hierarchy (for active leaf tasks)
  // ========================================

  const hierarchy = useMemo(() => {
    return buildTaskHierarchy(runs);
  }, [runs]);

  const activeLeafTasks = useMemo(() => {
    return findActiveLeafTasks(hierarchy);
  }, [hierarchy]);

  // ========================================
  // Intermediate Outputs (from ALL nodeUpdates, not just active)
  // ========================================

  const nodeUpdateOutputs = useMemo((): IntermediateLLMOutput[] => {
    if (!nodeUpdates || nodeUpdates.length === 0) return [];

    const outputs: IntermediateLLMOutput[] = [];

    for (const node of nodeUpdates) {
      // Skip if no streaming content
      if (!node.streamingContent && !node.completedOutput) continue;

      // Check if this is a final node
      const isFinal = finalNodeNames.some(
        (name) => node.nodeName.toLowerCase() === name.toLowerCase()
      );

      // Only include intermediate (non-final) nodes
      if (isFinal) continue;

      const content = node.streamingContent || node.completedOutput;
      if (!content.trim()) continue;

      // Create unique ID including namespace for proper tracking
      const namespaceStr = node.namespace.length > 0 ? `|${node.namespace.join("|")}` : "";
      const uniqueId = `${node.nodeName}${namespaceStr}`;

      outputs.push({
        nodeId: uniqueId,
        nodeName: node.nodeName,
        outputSnippet:
          content.length > 100 ? content.slice(0, 100) + "..." : content,
        fullOutput: content,
        status: node.isActive ? "streaming" : "completed",
        timestamp: node.timestamp,
        isFinal: false,
      });
    }

    return outputs;
  }, [nodeUpdates, finalNodeNames]);

  // ========================================
  // Intermediate AI Messages (from messages with langgraph_node metadata)
  // ========================================

  const intermediateMessageOutputs = useMemo((): IntermediateLLMOutput[] => {
    if (finalNodeNames.length === 0 || !messageNodeMap || messageNodeMap.size === 0) return [];

    const outputs: IntermediateLLMOutput[] = [];

    // Build outputs using messageNodeMap from Stream context
    for (let i = 0; i < typedMessages.length; i++) {
      const msg = typedMessages[i];
      if (msg.type !== "ai") continue;

      // Get node name from map (managed by Stream.tsx)
      const nodeName = messageNodeMap.get(i);

      // Skip if no node name
      if (!nodeName) continue;

      const isFinal = finalNodeNames.some(
        (name) => nodeName.toLowerCase() === name.toLowerCase()
      );

      // Only include intermediate (non-final) node messages
      if (isFinal) continue;

      // Extract text content from message
      let textContent = "";
      if (typeof msg.content === "string") {
        textContent = msg.content;
      } else if (Array.isArray(msg.content)) {
        textContent = msg.content
          .map((c) => {
            if (typeof c === "string") return c;
            if (typeof c === "object" && c !== null && "type" in c) {
              const block = c as { type: string; text?: string };
              if (block.type === "text" && block.text) {
                return block.text;
              }
            }
            return "";
          })
          .join("");
      }

      // Skip empty content
      if (!textContent.trim()) continue;

      outputs.push({
        nodeId: msg.id || `msg-${i}`,
        nodeName: nodeName,
        outputSnippet:
          textContent.length > 100
            ? textContent.slice(0, 100) + "..."
            : textContent,
        fullOutput: textContent,
        status: "completed",
        timestamp: i, // Use index for stable ordering
        isFinal: false,
      });
    }

    return outputs;
  }, [typedMessages, finalNodeNames, messageNodeMap]);

  // ========================================
  // Merged Intermediate Outputs
  // ========================================

  const intermediateOutputs = useMemo((): IntermediateLLMOutput[] => {
    // Priority: nodeUpdates (real-time) > messages (SDK confirmed)
    // nodeUpdates contains all intermediate nodes with their current/completed content
    const allOutputs = [...nodeUpdateOutputs];

    // Add message-based outputs for nodes not in nodeUpdates
    // (e.g., messages that came before nodeUpdates tracking started)
    for (const msgOutput of intermediateMessageOutputs) {
      const exists = allOutputs.some(
        (o) => o.nodeName === msgOutput.nodeName
      );
      if (!exists) {
        allOutputs.push(msgOutput);
      }
    }

    // Sort by timestamp (oldest first for chronological display)
    return allOutputs.sort((a, b) => a.timestamp - b.timestamp);
  }, [nodeUpdateOutputs, intermediateMessageOutputs]);

  // ========================================
  // Final Node Detection
  // ========================================

  const finalNodeId = useMemo((): string | null => {
    if (!nodeUpdates || nodeUpdates.length === 0) return null;

    // Find the most recently active node
    const activeNodes = nodeUpdates.filter((n) => n.isActive);
    if (activeNodes.length === 0) return null;

    const latest = activeNodes[activeNodes.length - 1];

    // Check if this is a final node
    const isFinal = finalNodeNames.some(
      (name) => latest.nodeName.toLowerCase() === name.toLowerCase()
    );

    return isFinal ? "main" : latest.nodeName;
  }, [nodeUpdates, finalNodeNames]);

  // ========================================
  // Visibility Check
  // ========================================

  // hasVisibleContent: true only when there's actual task/todo content
  // Used for compact filtering (determines if AI messages should be hidden)
  const hasVisibleContent =
    hasContent || activeLeafTasks.length > 0 || intermediateOutputs.length > 0;

  // showTaskView: true during streaming (for "thinking" indicator) OR when there's content
  // Used to determine if StreamingTaskView should be rendered
  const showTaskView = isStreaming || hasVisibleContent;

  return {
    progress: enrichedProgress,
    todoLifecycle: lifecycle,
    hasVisibleContent,
    showTaskView,
    activeLeafTasks,
    intermediateOutputs,
    finalNodeId,
  };
}
