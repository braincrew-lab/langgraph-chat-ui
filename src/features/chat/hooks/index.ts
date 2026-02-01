/**
 * Streaming View Hooks
 *
 * Simplified hooks for streaming view state management.
 * Uses flat list with grouping (no hierarchical nesting).
 *
 * ## Hook Composition
 * ```
 * useStreamingView (main export)
 * ├─ useTaskProgress - Flat task/todo extraction
 * └─ useLangSmithEnrichment - Simple LangSmith enrichment
 * ```
 */

// Main hook
export { useStreamingView, type TodoLifecycleState } from "./useStreamingView";

// Supporting hooks
export { useTaskProgress, groupProgressItems, isFilteredToolName } from "./useTaskProgress";
export { useLangSmithEnrichment, getRunsForTask, calculateTotalLatency, getActiveRunForTask } from "./useLangSmithEnrichment";

// Re-export utility types
export type {
  LangGraphMessage,
  CurrentToolCall,
  TaskScope,
  NodeUpdateInfo,
} from "./utils";

// Re-export utility functions
export {
  isTodoToolName,
  isTaskToolName,
  isSubagentTodo,
} from "./utils";
