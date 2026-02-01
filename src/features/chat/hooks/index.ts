/**
 * Streaming View Hooks
 *
 * Modular hooks for streaming view state management.
 * Composed from smaller, focused hooks.
 *
 * ## Hook Composition
 * ```
 * useStreamingView (main export)
 * ├─ useTaskExtraction - TODO/tool extraction from messages
 * ├─ useStreamingOutput - LLM output extraction
 * └─ useTaskHierarchy - Hierarchical TODO building
 * ```
 *
 * ## Data Flow
 * ```
 * LangSmith Runs + Messages
 * ├─ useTaskExtraction → currentTodo, currentToolCalls, taskScopes
 * ├─ useStreamingOutput → streamingLLMOutput, intermediateOutputs
 * └─ useTaskHierarchy → hierarchicalTodos
 * ```
 */

export { useTaskExtraction, type TodoLifecycleState } from "./useTaskExtraction";
export { useStreamingOutput } from "./useStreamingOutput";
export { useTaskHierarchy } from "./useTaskHierarchy";

// Re-export utility types
export type {
  LangGraphMessage,
  CurrentToolCall,
  TaskScope,
  NodeUpdateInfo,
  StreamingContext,
} from "./utils";

// Re-export utility functions for external use
export {
  isTodoToolName,
  isTaskToolName,
  isSubagentTodo,
  calculateTextSimilarity,
  collectAllTaskIds,
} from "./utils";
