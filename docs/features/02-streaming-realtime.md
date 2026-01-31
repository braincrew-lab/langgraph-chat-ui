# Streaming & Real-time

## Overview

The Streaming & Real-time feature handles live streaming of LangGraph agent responses, including token-by-token output, tool call tracking, node execution visualization, and subagent task monitoring. It provides real-time feedback during agent execution via Server-Sent Events (SSE).

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/providers/Stream.tsx` | 410 | Core stream provider, SSE event handling, context management |
| `src/hooks/useStreamingView.ts` | 2,954 | **CRITICAL** - View state management, TODO/task hierarchy, streaming output extraction |
| `src/types/task-hierarchy.ts` | ~200 | Type definitions for hierarchical tasks and TODOs |
| `src/types/langsmith.ts` | ~150 | LangSmith run types and task hierarchy builders |

## Data Flow

### SSE Event Flow

```
LangGraph Server (SSE)
         ↓
useStream() SDK Hook
         ↓
┌────────────────────────────┐
│   Stream.tsx Callbacks     │
│  ├─ onCustomEvent          │  → UI message updates
│  ├─ onUpdateEvent          │  → Node tracking, namespace mapping
│  └─ onThreadId             │  → Thread state sync
└────────────────────────────┘
         ↓
StreamContext (React Context)
         ↓
useStreamingView() Hook
         ↓
┌────────────────────────────┐
│   View State Extraction    │
│  ├─ extractTodosFromMessages()
│  ├─ extractCurrentToolCalls()
│  ├─ extractStreamingLLMOutput()
│  └─ buildHierarchicalTodosWithNesting()
└────────────────────────────┘
         ↓
StreamingTaskView Component
```

### State Structure

```typescript
// StreamContext provides:
{
  // From useStream SDK
  messages: Message[];
  isStreaming: boolean;
  submit: (input) => void;
  stop: () => void;

  // Extended state (Stream.tsx)
  nodeUpdates: NodeUpdateInfo[];      // SSE node tracking
  toolCallNamespaceMap: Map<string, string[]>;  // Parallel task separation
  clearNodeUpdates: () => void;
}

// useStreamingView returns:
{
  hierarchicalTodos: HierarchicalTodoItem[];  // TODO tree with tools/reasoning
  intermediateOutputs: IntermediateLLMOutput[];  // Per-node streaming output
  currentToolCalls: CurrentToolCall[];  // Active tool invocations
  todoLifecycle: "inactive" | "active" | "all_completed";
  hasVisibleContent: boolean;
}
```

## Logic Analysis

### Node Update Tracking (`Stream.tsx:136-240`)

The `handleUpdateEvent` callback processes SSE events to track:
1. **Node Names**: Extracted from event keys, excluding `__start__` and `__end__`
2. **Namespace**: Subgraph path for nested agents
3. **Tool Call Mapping**: Maps `tool_call_id` to namespace for parallel task separation
4. **Streaming Content**: Extracts message content from SSE payload

**Edge Case Handling**:
- Content arrays (multimodal): Iterates to extract text parts
- Single message vs array: Normalizes to array format
- Partial JSON during streaming: Handled by downstream parsers

### TODO Extraction (`useStreamingView.ts:914-1017`)

Extracts TODO items from two sources:
1. **TodoWrite tool calls**: Main agent's task list
2. **Task tool calls**: Subagent invocations parsed as child TODOs

```typescript
function extractTodosFromMessages(messages: unknown[]): TodoItem[] {
  // For each AI message with tool_calls:
  //   - TodoWrite → parse todos array
  //   - Task → create subagent TODO item
}
```

### Hierarchical TODO Building (`useStreamingView.ts:2023-2475`)

The `buildHierarchicalTodosWithNesting` function is the core algorithm:

1. **Extract TODOs**: From message tool calls
2. **Build Task Scopes**: Map tool_call_id to message ranges
3. **Match TODO-to-Subagent**: Order-based and similarity-based matching
4. **Attach Streaming Info**: Add current output, tools, reasoning
5. **Build Tree**: Nest children under parent TODOs

**Matching Strategies**:
- `toolCallId` exact match (confidence: 1.0)
- Message order-based matching (confidence: 0.5+)
- Text similarity + status matching (confidence: 0.3+)

## Potential Issues

### CRITICAL: File Size (`useStreamingView.ts` - 2,954 lines)

**Problem**: Single file contains 50+ functions spanning multiple responsibilities:
- TODO extraction and parsing
- Task hierarchy building
- Tool call tracking
- Streaming output extraction
- LangSmith integration
- View state management

**Impact**:
- Bundle size: Entire file loaded regardless of features used
- Maintainability: Difficult to understand and modify
- Testing: Hard to unit test individual functions

**Vercel Best Practice**: `bundle-code-splitting`

### HIGH: State Update Frequency (`Stream.tsx:236-237`)

```typescript
setNodeUpdates([...nodeUpdatesRef.current]);
setToolCallNamespaceMap(new Map(toolCallNamespaceMapRef.current));
```

**Problem**: Creates new array/map on every SSE event (potentially hundreds per second during streaming)

**Impact**:
- Re-renders propagate through context consumers
- Memory pressure from object allocation

**Vercel Best Practice**: `rerender-state-updates`

### HIGH: Expensive useMemo Dependencies

**Location**: `useStreamingView.ts:2843-2862`

```typescript
const hierarchicalTodos = useMemo(() => {
  return buildHierarchicalTodosWithNesting(
    currentTodo, subagentTasks, currentToolCalls,
    streamingLLMOutput, messages, subagentStreamingOutputs,
    finalNodeId, taskScopes, finalNodeNames, nodeUpdates,
    todoStatusOverrideRef.current, activeNodeHistoryRef.current,
    toolCallNamespaceMap
  );
}, [/* 12 dependencies */]);
```

**Problem**:
- Many dependencies cause frequent recalculation
- `messages` array changes on every chunk
- Refs in deps don't trigger updates but are included

**Impact**: CPU-intensive function runs on every message update

### MEDIUM: Synchronous JSON Parsing

**Location**: `useStreamingView.ts:646-652`, `671-678`

```typescript
todoArgs = parsePartialJson(todoArgs);
```

**Problem**: `parsePartialJson` called synchronously during render for partial streaming data

**Impact**: Blocks main thread during rapid streaming

### MEDIUM: Missing Error Boundaries

**Problem**: Streaming errors (network, parse) may crash the component tree

**Impact**: Poor error recovery during agent execution

## Refactoring Opportunities

### 1. Split `useStreamingView.ts` into Modules

**Current**: 2,954 lines, 50+ functions

**Proposed Structure**:
```
hooks/streaming/
├── index.ts                    # Main hook, re-exports
├── extractors/
│   ├── todos.ts               # extractTodosFromMessages, etc.
│   ├── tools.ts               # extractCurrentToolCalls, etc.
│   └── outputs.ts             # extractStreamingLLMOutput, etc.
├── matchers/
│   ├── todo-task.ts           # matchTodosToTasksByOrder, etc.
│   └── similarity.ts          # calculateTextSimilarity
├── builders/
│   ├── hierarchy.ts           # buildHierarchicalTodosWithNesting
│   └── scopes.ts              # buildTaskScopes
└── types.ts                   # Local types
```

**Benefits**:
- Tree-shakeable: Only import what's needed
- Testable: Unit test each module
- Maintainable: Clear responsibility boundaries

**Vercel Best Practice**: `bundle-code-splitting`, `bundle-minimize-bundle-size`

### 2. Debounce State Updates

**Current**: Every SSE event triggers state update

**Proposed**:
```typescript
const debouncedSetNodeUpdates = useDebouncedCallback(
  (updates) => setNodeUpdates(updates),
  16 // One frame
);
```

**Benefits**: Batch rapid updates, reduce re-renders

**Vercel Best Practice**: `rerender-debounce-throttle`

### 3. Web Worker for Heavy Computation

**Current**: `buildHierarchicalTodosWithNesting` runs on main thread

**Proposed**: Offload to Web Worker for:
- TODO extraction
- Hierarchy building
- Similarity matching

**Benefits**: Non-blocking streaming UI

**Vercel Best Practice**: `async-web-workers`

### 4. Virtualize Tool Call Lists

**Problem**: Long lists of tool calls during agent execution

**Proposed**: Use `@tanstack/react-virtual` for tool call rendering

**Vercel Best Practice**: `rerender-virtualization`

### 5. Memoize Extractors with `useMemo`

**Current**: Some extractors called directly in render

**Proposed**: Ensure all heavy extractors are memoized with stable dependencies

```typescript
const todos = useMemo(
  () => extractTodosFromMessages(messages),
  [messages] // Referential equality
);
```

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| CRITICAL | Split useStreamingView.ts (2,954 lines) | Large | Bundle size, maintainability |
| HIGH | State update frequency | Medium | Performance, re-renders |
| HIGH | Heavy useMemo computations | Medium | CPU during streaming |
| MEDIUM | Synchronous JSON parsing | Small | UI responsiveness |
| MEDIUM | Missing error boundaries | Small | Error recovery |
