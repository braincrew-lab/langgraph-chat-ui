/**
 * useLangSmithEnrichment Hook
 *
 * Enriches TaskProgressItems with LangSmith data.
 * Uses simple toolCallId matching (no fuzzy matching).
 *
 * This hook is separate from useTaskProgress to:
 * - Keep message-based extraction independent
 * - Allow graceful degradation when LangSmith is unavailable
 * - Simplify the data flow
 */

import { useMemo } from "react";
import type {
  TaskProgressItem,
  LangSmithEnrichment,
} from "@/types/task-progress";
import type { LangSmithRun } from "@/types/langsmith";

// ============================================
// Types
// ============================================

interface UseLangSmithEnrichmentOptions {
  progress: TaskProgressItem[];
  runs: LangSmithRun[];
  isLoading?: boolean;
}

interface UseLangSmithEnrichmentReturn {
  /** Progress items enriched with LangSmith data */
  enrichedProgress: TaskProgressItem[];
  /** Whether LangSmith data is loading */
  isLoading: boolean;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract tool_call_id from a LangSmith run
 * Tries multiple locations where the ID might be stored
 */
function extractToolCallIdFromRun(run: LangSmithRun): string | null {
  // Check inputs.tool_call_id
  if (run.inputs && typeof run.inputs === "object") {
    const inputs = run.inputs as Record<string, unknown>;

    if (typeof inputs.tool_call_id === "string" && inputs.tool_call_id) {
      return inputs.tool_call_id;
    }

    // Check nested inputs.input.tool_call_id
    if (inputs.input && typeof inputs.input === "object") {
      const input = inputs.input as Record<string, unknown>;
      if (typeof input.tool_call_id === "string" && input.tool_call_id) {
        return input.tool_call_id;
      }
    }

    // Check inputs.messages for tool_call_id
    if (Array.isArray(inputs.messages)) {
      for (const msg of inputs.messages) {
        if (msg && typeof msg === "object") {
          const message = msg as Record<string, unknown>;
          if (
            typeof message.tool_call_id === "string" &&
            message.tool_call_id
          ) {
            return message.tool_call_id;
          }
          // Check tool_calls array for AI messages
          if (
            Array.isArray(message.tool_calls) &&
            message.tool_calls.length > 0
          ) {
            const toolCall = message.tool_calls[0] as Record<string, unknown>;
            if (typeof toolCall.id === "string" && toolCall.id) {
              return toolCall.id;
            }
          }
        }
      }
    }
  }

  // Check metadata.tool_call_id
  if (run.metadata && typeof run.metadata === "object") {
    const metadata = run.metadata as Record<string, unknown>;

    if (typeof metadata.tool_call_id === "string" && metadata.tool_call_id) {
      return metadata.tool_call_id;
    }

    // Check LangGraph-specific field
    if (
      typeof metadata.langgraph_tool_call_id === "string" &&
      metadata.langgraph_tool_call_id
    ) {
      return metadata.langgraph_tool_call_id;
    }
  }

  return null;
}

/**
 * Extract token usage from LangSmith run outputs
 */
function extractTokenUsage(
  run: LangSmithRun,
): LangSmithEnrichment["tokenUsage"] | undefined {
  if (!run.outputs) return undefined;

  const outputs = run.outputs as Record<string, unknown>;

  // Check llm_output.token_usage (OpenAI format)
  if (outputs.llm_output && typeof outputs.llm_output === "object") {
    const llmOutput = outputs.llm_output as Record<string, unknown>;

    if (llmOutput.token_usage && typeof llmOutput.token_usage === "object") {
      const tokenUsage = llmOutput.token_usage as Record<string, number>;
      return {
        input: tokenUsage.prompt_tokens || 0,
        output: tokenUsage.completion_tokens || 0,
      };
    }

    // Check usage (Anthropic format)
    if (llmOutput.usage && typeof llmOutput.usage === "object") {
      const usage = llmOutput.usage as Record<string, number>;
      return {
        input: usage.input_tokens || 0,
        output: usage.output_tokens || 0,
      };
    }
  }

  // Direct usage field
  if (outputs.usage && typeof outputs.usage === "object") {
    const usage = outputs.usage as Record<string, number>;
    return {
      input: usage.input_tokens || usage.prompt_tokens || 0,
      output: usage.output_tokens || usage.completion_tokens || 0,
    };
  }

  return undefined;
}

/**
 * Extract model name from LangSmith run
 */
function extractModelName(run: LangSmithRun): string | undefined {
  // Check metadata
  if (run.metadata?.ls_model_name) {
    return run.metadata.ls_model_name as string;
  }

  // Check invocation_params
  if (run.inputs && typeof run.inputs === "object") {
    const inputs = run.inputs as Record<string, unknown>;

    if (
      inputs.invocation_params &&
      typeof inputs.invocation_params === "object"
    ) {
      const params = inputs.invocation_params as Record<string, unknown>;
      if (params.model_name) return params.model_name as string;
      if (params.model) return params.model as string;
    }

    // Check kwargs
    if (inputs.kwargs && typeof inputs.kwargs === "object") {
      const kwargs = inputs.kwargs as Record<string, unknown>;
      if (kwargs.model_name) return kwargs.model_name as string;
      if (kwargs.model) return kwargs.model as string;
    }
  }

  return undefined;
}

/**
 * Map run status to enrichment status
 */
function mapRunStatus(status: string): LangSmithEnrichment["status"] {
  switch (status) {
    case "success":
      return "completed";
    case "error":
      return "error";
    default:
      return "running";
  }
}

/**
 * Build a map of toolCallId -> LangSmithRun for quick lookup
 */
function buildToolCallIdIndex(runs: LangSmithRun[]): Map<string, LangSmithRun> {
  const index = new Map<string, LangSmithRun>();

  for (const run of runs) {
    const toolCallId = extractToolCallIdFromRun(run);
    if (toolCallId) {
      index.set(toolCallId, run);
    }
  }

  return index;
}

/**
 * Create enrichment data from a LangSmith run
 */
function createEnrichment(run: LangSmithRun): LangSmithEnrichment {
  return {
    runId: run.id,
    latency: run.latency,
    tokenUsage: extractTokenUsage(run),
    model: extractModelName(run),
    status: mapRunStatus(run.status),
  };
}

// ============================================
// Main Hook
// ============================================

/**
 * Enriches progress items with LangSmith data
 *
 * Uses simple toolCallId matching - no fuzzy matching or complex algorithms.
 * This keeps the logic simple and predictable.
 */
export function useLangSmithEnrichment(
  options: UseLangSmithEnrichmentOptions,
): UseLangSmithEnrichmentReturn {
  const { progress, runs, isLoading = false } = options;

  const enrichedProgress = useMemo(() => {
    // Build index for O(1) lookups
    const runByToolCallId = buildToolCallIdIndex(runs);

    // Enrich each progress item
    return progress.map((item) => {
      // Skip if no toolCallId
      if (!item.toolCallId) return item;

      // Look up matching run
      const run = runByToolCallId.get(item.toolCallId);
      if (!run) return item;

      // Return enriched item
      return {
        ...item,
        langsmith: createEnrichment(run),
      };
    });
  }, [progress, runs]);

  return {
    enrichedProgress,
    isLoading,
  };
}

// ============================================
// Additional Utilities
// ============================================

/**
 * Get runs for a specific task by toolCallId
 * Useful for getting all child runs of a task
 */
export function getRunsForTask(
  toolCallId: string,
  runs: LangSmithRun[],
): LangSmithRun[] {
  // Find the run with this toolCallId
  const taskRun = runs.find((run) => {
    const id = extractToolCallIdFromRun(run);
    return id === toolCallId;
  });

  if (!taskRun) return [];

  // Find all child runs
  const childRuns: LangSmithRun[] = [];

  function findChildren(parentId: string) {
    for (const run of runs) {
      if (run.parentRunId === parentId) {
        childRuns.push(run);
        findChildren(run.id);
      }
    }
  }

  findChildren(taskRun.id);
  return childRuns;
}

/**
 * Calculate total latency for a task including all child runs
 */
export function calculateTotalLatency(
  toolCallId: string,
  runs: LangSmithRun[],
): number | undefined {
  const taskRun = runs.find((run) => {
    const id = extractToolCallIdFromRun(run);
    return id === toolCallId;
  });

  if (!taskRun || taskRun.latency === undefined) return undefined;
  return taskRun.latency;
}

/**
 * Get the deepest active run for a task
 * Useful for showing what's currently happening
 */
export function getActiveRunForTask(
  toolCallId: string,
  runs: LangSmithRun[],
): LangSmithRun | undefined {
  const childRuns = getRunsForTask(toolCallId, runs);
  const activeRuns = childRuns.filter((r) => r.status === "running");

  if (activeRuns.length === 0) return undefined;

  // Return the most recently started active run
  return activeRuns.sort((a, b) => {
    const aTime = new Date(a.startTime).getTime();
    const bTime = new Date(b.startTime).getTime();
    return bTime - aTime;
  })[0];
}
