/**
 * useTaskHierarchy Hook
 *
 * Builds hierarchical TODO structure from flat TODO list.
 * Integrates with LangSmith data for tool/reasoning extraction.
 */

import { useMemo, useRef, useEffect } from "react";
import type { TodoItem, HierarchicalTask, HierarchicalTodoItem, ToolCallInfo, ReasoningInfo } from "@/types/task-hierarchy";
import {
  type LangGraphMessage,
  type CurrentToolCall,
  type TaskScope,
  type IndexedTodo,
  type StreamingContext,
  type NodeUpdateInfo,
  isTaskToolName,
  isTodoToolName,
  buildToolCallIdIndex,
  buildSubagentTypeIndex,
  extractToolsFromTask,
  extractReasoningFromTask,
  extractToolsFromMessagesForTask,
  createHierarchicalTodoItem,
  attachStreamingInfo,
  matchTodoToSubagentFuzzy,
  findBestMatchingParent,
  matchSubagentToParentByNodeHistory,
  matchSubagentToParentByMessageOrder,
  partitionTodosByType,
  extractTodosArraySafe,
  safeMapToTodoItems,
} from "./utils";
import { parsePartialJson } from "@langchain/core/output_parsers";

interface UseTaskHierarchyOptions {
  todos: TodoItem[];
  subagentTasks: HierarchicalTask[];
  currentToolCalls: CurrentToolCall[];
  streamingLLMOutput: string | null;
  messages: unknown[];
  subagentStreamingOutputs: Map<string, string>;
  finalNodeId: string | null;
  taskScopes: Map<string, TaskScope>;
  finalNodeNames?: string[];
  nodeUpdates?: NodeUpdateInfo[];
  currentActiveNode: string | null;
}

interface UseTaskHierarchyReturn {
  /** Hierarchical TODO items */
  hierarchicalTodos: HierarchicalTodoItem[];
}

/**
 * Extract tools and reasoning with LangSmith matching
 */
function extractToolsAndReasoningWithMatch(
  todo: TodoItem,
  originalIndex: number,
  subagents: HierarchicalTask[],
  usedTaskIds: Set<string>,
  toolCallIdIndex: Map<string, HierarchicalTask>,
  messages: LangGraphMessage[],
  linkedTaskToolCallId: string | undefined,
  taskScopes: Map<string, TaskScope>,
  subagentTypeIndex: Map<string, HierarchicalTask[]>
): {
  tools: ToolCallInfo[];
  reasoning: ReasoningInfo[];
  match: { taskId: string; taskName: string; confidence: number } | null;
} {
  let tools: ToolCallInfo[] = [];
  let reasoning: ReasoningInfo[] = [];
  let match: { taskId: string; taskName: string; confidence: number } | null = null;

  // Detect parallel Task
  let isParallelTask = false;
  if (linkedTaskToolCallId && taskScopes) {
    const currentScope = taskScopes.get(linkedTaskToolCallId);
    if (currentScope) {
      for (const [otherId, otherScope] of taskScopes) {
        if (otherId !== linkedTaskToolCallId && otherScope.startMessageIndex === currentScope.startMessageIndex) {
          isParallelTask = true;
          break;
        }
      }
    }
  }

  // PRIMARY: subagentType + description matching
  let langSmithMatch: HierarchicalTask | null = null;

  if (subagentTypeIndex && todo.subagentType) {
    const candidates = subagentTypeIndex.get(todo.subagentType.toLowerCase());
    if (candidates && candidates.length > 0) {
      const sortedCandidates = [...candidates].sort((a, b) => {
        const aHasChildren = a.children.length > 0 ? 1 : 0;
        const bHasChildren = b.children.length > 0 ? 1 : 0;
        return bHasChildren - aHasChildren;
      });

      for (const candidate of sortedCandidates) {
        if (usedTaskIds.has(candidate.id)) continue;

        langSmithMatch = candidate;
        match = { taskId: candidate.id, taskName: candidate.name, confidence: 1.0 };
        usedTaskIds.add(candidate.id);
        reasoning = extractReasoningFromTask(candidate);
        break;
      }
    }
  }

  // FALLBACK: toolCallId matching
  if (!langSmithMatch && linkedTaskToolCallId) {
    const exactMatch = toolCallIdIndex.get(linkedTaskToolCallId);
    if (exactMatch && !usedTaskIds.has(exactMatch.id)) {
      langSmithMatch = exactMatch;
      match = { taskId: exactMatch.id, taskName: exactMatch.name, confidence: 1.0 };
      usedTaskIds.add(exactMatch.id);
      reasoning = extractReasoningFromTask(exactMatch);
    }
  }

  // Tool extraction
  if (langSmithMatch) {
    tools = extractToolsFromTask(langSmithMatch);
    if (tools.length === 0 && !isParallelTask && linkedTaskToolCallId && messages) {
      tools = extractToolsFromMessagesForTask(messages, linkedTaskToolCallId, taskScopes);
    }
  } else if (isParallelTask && linkedTaskToolCallId && messages && taskScopes) {
    tools = [];
  } else if (linkedTaskToolCallId && messages) {
    tools = extractToolsFromMessagesForTask(messages, linkedTaskToolCallId, taskScopes);
  }

  // Fuzzy matching for metadata only
  if (!match) {
    const fuzzyMatch = matchTodoToSubagentFuzzy(todo, originalIndex, subagents, usedTaskIds);
    if (fuzzyMatch) {
      match = fuzzyMatch;
      usedTaskIds.add(fuzzyMatch.taskId);

      const matchedTask = subagents.find((t) => t.id === fuzzyMatch.taskId);
      if (matchedTask) {
        reasoning = extractReasoningFromTask(matchedTask);
      }
    }
  }

  return { tools, reasoning, match };
}

/**
 * Build hierarchical TODO structure with nesting
 */
function buildHierarchicalTodosWithNesting(
  todos: TodoItem[],
  subagents: HierarchicalTask[],
  currentToolCalls: CurrentToolCall[],
  streamingLLMOutput: string | null,
  messages: LangGraphMessage[],
  subagentStreamingOutputs: Map<string, string>,
  finalNodeId: string | null,
  taskScopes: Map<string, TaskScope>,
  finalNodeNames: string[],
  nodeUpdates: NodeUpdateInfo[] | undefined,
  todoStatusOverride: Map<string, TodoItem["status"]>,
  activeNodeHistory: string[]
): HierarchicalTodoItem[] {
  const toolCallIdIndex = buildToolCallIdIndex(subagents);
  const subagentTypeIndex = buildSubagentTypeIndex(subagents);
  const finalNodeSet = new Set(finalNodeNames);
  const activeNodeName = nodeUpdates?.find((n) => n.isActive)?.nodeName;

  const isFinalTask = (todo: TodoItem): boolean => {
    if (!todo.nodeName || finalNodeSet.size === 0) return false;
    return finalNodeSet.has(todo.nodeName);
  };

  const getUpdatedStatus = (todo: TodoItem): TodoItem["status"] => {
    const override = todoStatusOverride?.get(todo.id);
    if (override) return override;
    if (todo.status === "completed") return "completed";
    if (activeNodeName && todo.nodeName === activeNodeName) return "in_progress";
    return todo.status;
  };

  // Empty todos with Task calls: create synthetic item
  if (todos.length === 0) {
    const hasActiveTaskCall = messages.some((msg) => {
      if (msg.type !== "ai" || !Array.isArray(msg.tool_calls)) return false;
      return msg.tool_calls.some((tc) => tc.name?.toLowerCase() === "task");
    });

    if (hasActiveTaskCall && (currentToolCalls.length > 0 || streamingLLMOutput)) {
      const syntheticTools: ToolCallInfo[] = currentToolCalls.map((tc) => ({
        id: tc.id || `tool-${tc.name}`,
        name: tc.name,
        args: tc.args,
        status: tc.status === "completed" ? "completed" : "running",
      }));

      const syntheticReasoning: ReasoningInfo[] = [];
      if (streamingLLMOutput) {
        syntheticReasoning.push({ id: "streaming-llm", name: "LLM", status: "running", outputText: streamingLLMOutput });
      }

      return [
        {
          id: "synthetic-task",
          content: "작업 진행 중",
          status: "in_progress",
          activeForm: "처리 중...",
          depth: 0,
          children: [],
          tools: syntheticTools,
          reasoning: syntheticReasoning,
        },
      ];
    }

    return [];
  }

  const { mainTodos, subagentTodos } = partitionTodosByType(todos);

  // Collect completed Task IDs
  const completedTaskIds = new Set<string>();
  for (const msg of messages) {
    const m = msg as { type?: string; tool_call_id?: string; name?: string };
    if (m.type === "tool" && m.tool_call_id && isTaskToolName(m.name)) {
      completedTaskIds.add(m.tool_call_id);
    }
  }

  // Handle case when no main todos (only subagent todos)
  if (mainTodos.length === 0 && subagentTodos.length > 0) {
    const result: HierarchicalTodoItem[] = [];
    const usedTaskIds = new Set<string>();
    let firstInProgressAssigned = false;

    for (const { todo, originalIndex } of subagentTodos) {
      const linkedTaskToolCallId = todo.linkedTaskToolCallId;
      const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

      let computedStatus: TodoItem["status"];
      if (isTaskCompleted || todo.status === "completed") {
        computedStatus = "completed";
      } else if (!firstInProgressAssigned && activeNodeName) {
        computedStatus = "in_progress";
        firstInProgressAssigned = true;
      } else if (!firstInProgressAssigned && !activeNodeName && todo.status === "in_progress") {
        computedStatus = "in_progress";
        firstInProgressAssigned = true;
      } else {
        const override = todoStatusOverride?.get(todo.id);
        computedStatus = override ?? todo.status;
      }

      const { tools: rawTools, reasoning, match } = extractToolsAndReasoningWithMatch(
        todo,
        originalIndex,
        subagents,
        usedTaskIds,
        toolCallIdIndex,
        messages,
        linkedTaskToolCallId,
        taskScopes,
        subagentTypeIndex
      );

      let finalTools = rawTools;
      let finalReasoning = reasoning;
      const isFinalNode = linkedTaskToolCallId === finalNodeId;
      if (computedStatus === "in_progress" && isFinalNode) {
        const subagentOutput = linkedTaskToolCallId ? subagentStreamingOutputs?.get(linkedTaskToolCallId) ?? null : null;
        const subagentContext: StreamingContext = { streamingLLMOutput: subagentOutput, currentToolCalls: [], streamingOutputUsed: false };
        const attached = attachStreamingInfo(rawTools, reasoning, subagentContext);
        finalTools = attached.tools;
        finalReasoning = attached.reasoning;
      }

      const item = createHierarchicalTodoItem(
        todo,
        0,
        finalTools,
        finalReasoning,
        match,
        linkedTaskToolCallId,
        isTaskCompleted,
        isFinalTask(todo),
        computedStatus
      );
      result.push(item);
    }

    return result;
  }

  // Build parent-child relationships
  const parentCandidates = mainTodos.filter((m) => m.todo.status === "in_progress" || m.todo.status === "pending");
  const effectiveParents = parentCandidates.length > 0 ? parentCandidates : mainTodos;
  const mainToSubagentMap = new Map<string, IndexedTodo[]>();
  const usedParentIds = new Set<string>();

  for (let i = 0; i < subagentTodos.length; i++) {
    const subagentTodo = subagentTodos[i];
    const availableParents = effectiveParents.filter((p) => !usedParentIds.has(p.todo.id));

    let bestParent = matchSubagentToParentByNodeHistory(subagentTodo.todo, availableParents, activeNodeHistory);

    if (!bestParent) {
      bestParent = matchSubagentToParentByMessageOrder(subagentTodo.todo, availableParents, messages, taskScopes);
    }

    if (!bestParent) {
      bestParent = findBestMatchingParent(subagentTodo.todo, availableParents);
    }

    if (!bestParent && availableParents.length > 0) {
      bestParent = availableParents[0];
    }

    if (!bestParent && mainTodos.length > 0) {
      const parentIndex = Math.min(i, mainTodos.length - 1);
      bestParent = mainTodos[parentIndex];
    }

    if (bestParent) {
      const parentId = bestParent.todo.id;
      usedParentIds.add(parentId);
      if (!mainToSubagentMap.has(parentId)) {
        mainToSubagentMap.set(parentId, []);
      }
      mainToSubagentMap.get(parentId)!.push(subagentTodo);
    }
  }

  // Build result
  const streamingContext: StreamingContext = { streamingLLMOutput, currentToolCalls, streamingOutputUsed: false };
  const resultMap = new Map<string, HierarchicalTodoItem>();
  const result: HierarchicalTodoItem[] = [];
  const usedTaskIds = new Set<string>();

  // Order-based TODO-Task matching
  const todoToTaskMap = new Map<string, string>();
  messages.forEach((msg, msgIdx) => {
    const m = msg as LangGraphMessage;
    if (m.type !== "ai" || !Array.isArray(m.tool_calls)) return;

    const inProgressTodos: Array<{ content: string; idx: number }> = [];
    const taskCalls: Array<{ toolCallId: string; idx: number }> = [];

    m.tool_calls.forEach((tc, tcIdx) => {
      if (isTodoToolName(tc.name)) {
        let todoArgs: unknown = tc.args;
        if (typeof todoArgs === "string" && todoArgs.length > 0) {
          try {
            todoArgs = parsePartialJson(todoArgs);
          } catch {
            return;
          }
        }
        const todosArr = extractTodosArraySafe(todoArgs);
        if (todosArr) {
          const items = safeMapToTodoItems(todosArr);
          items.forEach((todo, todoIdx) => {
            if (todo.status === "in_progress") {
              inProgressTodos.push({ content: todo.content, idx: todoIdx });
            }
          });
        }
      }

      if (isTaskToolName(tc.name) && tc.id) {
        taskCalls.push({ toolCallId: tc.id, idx: tcIdx });
      }
    });

    const minLen = Math.min(inProgressTodos.length, taskCalls.length);
    for (let i = 0; i < minLen; i++) {
      todoToTaskMap.set(inProgressTodos[i].content, taskCalls[i].toolCallId);
    }
  });

  // Process main TODOs
  for (const { todo } of mainTodos) {
    const linkedTaskToolCallId = todoToTaskMap.get(todo.content);
    const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

    const finalTools: ToolCallInfo[] = [];
    const finalReasoning: ReasoningInfo[] = [];
    const updatedStatus = getUpdatedStatus(todo);

    if (updatedStatus === "in_progress" && streamingLLMOutput && !streamingContext.streamingOutputUsed && finalNodeId === "main") {
      finalReasoning.push({ id: "streaming-llm", name: "LLM", status: "running", outputText: streamingLLMOutput });
      streamingContext.streamingOutputUsed = true;
    }

    const item = createHierarchicalTodoItem(todo, 0, finalTools, finalReasoning, null, linkedTaskToolCallId, isTaskCompleted, isFinalTask(todo), updatedStatus);
    resultMap.set(todo.id, item);
    result.push(item);
  }

  // Nest subagent TODOs under parents
  for (const [parentId, childTodos] of mainToSubagentMap) {
    const parent = resultMap.get(parentId);
    if (!parent) continue;

    for (const { todo, originalIndex } of childTodos) {
      const linkedTaskToolCallId = todo.linkedTaskToolCallId || todoToTaskMap.get(todo.content);
      const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

      const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
        todo,
        originalIndex,
        subagents,
        usedTaskIds,
        toolCallIdIndex,
        messages,
        linkedTaskToolCallId,
        taskScopes,
        subagentTypeIndex
      );

      let finalTools = tools;
      let finalReasoning = reasoning;
      const isFinalNode = linkedTaskToolCallId === finalNodeId;
      if (todo.status === "in_progress" && isFinalNode) {
        const subagentOutput = linkedTaskToolCallId ? subagentStreamingOutputs?.get(linkedTaskToolCallId) ?? null : null;
        const subagentContext: StreamingContext = { streamingLLMOutput: subagentOutput, currentToolCalls: [], streamingOutputUsed: false };
        const attached = attachStreamingInfo(tools, reasoning, subagentContext);
        finalTools = attached.tools;
        finalReasoning = attached.reasoning;
      }

      const childItem = createHierarchicalTodoItem(
        todo,
        1,
        finalTools,
        finalReasoning,
        match,
        linkedTaskToolCallId,
        isTaskCompleted,
        isFinalTask(todo),
        getUpdatedStatus(todo)
      );
      parent.children.push(childItem);
    }
  }

  // Process orphan subagent TODOs
  const assignedSubagentIds = new Set<string>();
  for (const children of mainToSubagentMap.values()) {
    for (const child of children) {
      assignedSubagentIds.add(child.todo.id);
    }
  }

  for (const { todo, originalIndex } of subagentTodos) {
    if (assignedSubagentIds.has(todo.id)) continue;

    const linkedTaskToolCallId = todo.linkedTaskToolCallId || todoToTaskMap.get(todo.content);
    const isTaskCompleted = linkedTaskToolCallId ? completedTaskIds.has(linkedTaskToolCallId) : false;

    const { tools, reasoning, match } = extractToolsAndReasoningWithMatch(
      todo,
      originalIndex,
      subagents,
      usedTaskIds,
      toolCallIdIndex,
      messages,
      linkedTaskToolCallId,
      taskScopes,
      subagentTypeIndex
    );

    let finalTools = tools;
    let finalReasoning = reasoning;
    const isFinalNode = linkedTaskToolCallId === finalNodeId;
    if (todo.status === "in_progress" && isFinalNode) {
      const subagentOutput = linkedTaskToolCallId ? subagentStreamingOutputs?.get(linkedTaskToolCallId) ?? null : null;
      const subagentContext: StreamingContext = { streamingLLMOutput: subagentOutput, currentToolCalls: [], streamingOutputUsed: false };
      const attached = attachStreamingInfo(tools, reasoning, subagentContext);
      finalTools = attached.tools;
      finalReasoning = attached.reasoning;
    }

    const childItem = createHierarchicalTodoItem(
      todo,
      0,
      finalTools,
      finalReasoning,
      match,
      linkedTaskToolCallId,
      isTaskCompleted,
      isFinalTask(todo),
      getUpdatedStatus(todo)
    );
    result.push(childItem);
  }

  return result;
}

/**
 * Hook for building hierarchical TODO structure
 */
export function useTaskHierarchy(options: UseTaskHierarchyOptions): UseTaskHierarchyReturn {
  const {
    todos,
    subagentTasks,
    currentToolCalls,
    streamingLLMOutput,
    messages,
    subagentStreamingOutputs,
    finalNodeId,
    taskScopes,
    finalNodeNames = [],
    nodeUpdates,
    currentActiveNode,
  } = options;

  // TODO status override map (for node transition-based updates)
  const todoStatusOverrideRef = useRef<Map<string, TodoItem["status"]>>(new Map());

  // Active node history (for subagent parent matching)
  const activeNodeHistoryRef = useRef<string[]>([]);

  // Track previous active node
  const prevActiveNodeRef = useRef<string | null>(null);

  // Update TODO status on node transition
  useEffect(() => {
    const prevNode = prevActiveNodeRef.current;

    // Update node history
    if (currentActiveNode && activeNodeHistoryRef.current[activeNodeHistoryRef.current.length - 1] !== currentActiveNode) {
      activeNodeHistoryRef.current.push(currentActiveNode);
      if (activeNodeHistoryRef.current.length > 10) {
        activeNodeHistoryRef.current.shift();
      }
    }

    // Node transition: mark previous in_progress as completed
    if (prevNode && prevNode !== currentActiveNode) {
      for (const todo of todos) {
        const currentOverride = todoStatusOverrideRef.current.get(todo.id);
        if (currentOverride === "in_progress") {
          todoStatusOverrideRef.current.set(todo.id, "completed");
        }
      }
    }

    // Mark first pending as in_progress
    if (currentActiveNode && todos.length > 0) {
      const pendingTodo = todos.find((t) => {
        const override = todoStatusOverrideRef.current.get(t.id);
        return !override && t.status === "pending";
      });

      if (pendingTodo) {
        todoStatusOverrideRef.current.set(pendingTodo.id, "in_progress");
      }
    }

    prevActiveNodeRef.current = currentActiveNode;
  }, [currentActiveNode, todos]);

  // Reset on new conversation
  useEffect(() => {
    if (messages.length === 0) {
      todoStatusOverrideRef.current.clear();
      activeNodeHistoryRef.current = [];
    }
  }, [messages.length]);

  // Build hierarchical TODOs
  const hierarchicalTodos = useMemo(() => {
    return buildHierarchicalTodosWithNesting(
      todos,
      subagentTasks,
      currentToolCalls,
      streamingLLMOutput,
      messages as LangGraphMessage[],
      subagentStreamingOutputs,
      finalNodeId,
      taskScopes,
      finalNodeNames,
      nodeUpdates,
      todoStatusOverrideRef.current,
      activeNodeHistoryRef.current
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    todos,
    subagentTasks,
    currentToolCalls,
    streamingLLMOutput,
    messages,
    subagentStreamingOutputs,
    finalNodeId,
    taskScopes,
    finalNodeNames,
    nodeUpdates,
    currentActiveNode,
  ]);

  return { hierarchicalTodos };
}
