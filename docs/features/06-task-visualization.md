# Task Visualization

## Overview

Task Visualization displays real-time agent execution progress through hierarchical TODO lists, tool call tracking, LLM reasoning steps, and subagent activity. It provides both a compact "streaming task view" inline with messages and an optional detailed "execution timeline" sidebar powered by LangSmith tracing.

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/components/thread/streaming-task-view.tsx` | 76 | Main task view container |
| `src/components/thread/streaming/hierarchical-todo-list.tsx` | 439 | Recursive TODO tree with tools/reasoning |
| `src/components/thread/streaming/active-task.tsx` | ~100 | Active task cards |
| `src/components/thread/streaming/intermediate-llm-outputs.tsx` | ~150 | Per-node output display |
| `src/components/thread/streaming/task-tree-item.tsx` | ~200 | Tree node rendering |
| `src/components/thread/streaming/subagent-output.tsx` | ~150 | Subagent output display |
| `src/components/thread/streaming/index.ts` | 8 | **Barrel export** |
| `src/components/thread/execution-timeline-panel.tsx` | 394 | LangSmith timeline sidebar |
| `src/types/task-hierarchy.ts` | 151 | Type definitions |
| `src/hooks/useStreamingView.ts` | 2,954 | Data extraction and processing |

## Data Flow

### Task Hierarchy Building

```
Messages (SSE Events)
         ↓
useStreamingView() hook
├─ extractTodosFromMessages()     → TodoItem[]
├─ extractCurrentToolCalls()      → CurrentToolCall[]
├─ extractStreamingLLMOutput()    → string
├─ buildTaskScopes()              → Map<toolCallId, TaskScope>
├─ matchTodosToTasksByOrder()     → Map<todoContent, toolCallId>
└─ buildHierarchicalTodosWithNesting()
         ↓
HierarchicalTodoItem[]
├─ id, content, status
├─ children[]  (nested TODOs)
├─ tools[]     (ToolCallInfo)
├─ reasoning[] (ReasoningInfo)
└─ matchedTaskId, matchedTaskName
         ↓
StreamingTaskView
├─ IntermediateLLMOutputList (node outputs)
├─ HierarchicalTodoList      (TODO tree)
└─ ActiveTasksList           (fallback)
```

### LangSmith Integration (Optional)

```
ThreadId
    ↓
useLangSmithRuns() hook
├─ GET /api/langsmith/runs?threadId=xxx
├─ Filter: toolRuns, llmRuns, middlewareRuns
└─ Polling during streaming (2s interval)
    ↓
ExecutionTimelinePanel
├─ Task tree with timing
├─ Tool call details
├─ LLM invocation metrics
└─ Error tracking
```

## Logic Analysis

### TODO-to-Task Matching (`useStreamingView.ts:696-719`)

Order-based matching algorithm:
1. Extract in_progress TODOs from TodoWrite tool calls
2. Extract Task tool calls with `tool_call_id`
3. Match by order: 1st TODO → 1st Task, 2nd → 2nd, etc.
4. Store mapping: `todoContent → taskToolCallId`

```typescript
function matchTodosToTasksByOrder(
  inProgressTodos: ExtractedTodoInfo[],
  taskCalls: ExtractedTaskCallInfo[]
): Map<string, string> {
  // ...
  for (let i = 0; i < Math.min(inProgressTodos.length, taskCalls.length); i++) {
    result.set(inProgressTodos[i].todo.content, taskCalls[i].toolCallId);
  }
}
```

### Task Scope Building (`useStreamingView.ts:563-610`)

Tracks tool call boundaries for parallel task separation:
1. Find Task tool call start indices
2. Find Task tool result end indices
3. Collect tool_call_ids within each scope

```typescript
interface TaskScope {
  taskToolCallId: string;
  startMessageIndex: number;
  endMessageIndex: number;  // -1 if still running
  toolCallIds: string[];    // Tools within this scope
}
```

### Status Determination

**TODO Status**:
| Status | Source |
|--------|--------|
| `pending` | Default, no activity |
| `in_progress` | From TodoWrite tool args |
| `completed` | From TodoWrite OR tool result detection |

**Task Status**:
| Status | Condition |
|--------|-----------|
| `pending` | Not started |
| `running` | Task tool called, no result yet |
| `completed` | Task tool result received |
| `error` | Error in tool result |

## Potential Issues

### HIGH: Barrel Export Pattern (`streaming/index.ts`)

**Location**: `src/components/thread/streaming/index.ts`

```typescript
export { TodoList } from "./todo-list";
export { ActiveTask, ActiveTasksList } from "./active-task";
export { CompletedSummary } from "./completed-summary";
// ...7 total re-exports
```

**Problem**: Barrel exports defeat tree-shaking. Importing one component loads all 7 files.

**Impact**: Unnecessary bundle size for unused components

**Vercel Best Practice**: `bundle-barrel-exports`

### HIGH: framer-motion Heavy Usage

**Location**: All streaming components use `motion.*` and `AnimatePresence`

```typescript
import { motion, AnimatePresence } from "framer-motion";
```

**Problem**:
- Full framer-motion bundle (~150KB)
- `AnimatePresence` adds layout complexity
- Many animated components during streaming

**Impact**: Performance during rapid updates

**Vercel Best Practice**: `bundle-minimize-bundle-size`

### MEDIUM: LangSmith Polling Without Caching

**Location**: `useLangSmithRuns` hook

**Problem**: Polls LangSmith API every 2 seconds without deduplication or caching

**Impact**: Unnecessary API calls, potential rate limiting

### MEDIUM: Recursive Component Without Memoization

**Location**: `hierarchical-todo-list.tsx:209-336`

```typescript
function HierarchicalTodoItemComponent({...}) {
  // Not memoized
  return (
    <div>
      {item.children.map((child) => (
        <HierarchicalTodoItemComponent ... />
      ))}
    </div>
  );
}
```

**Problem**: Re-renders entire tree on any state change

**Impact**: Performance with deep TODO hierarchies

### MEDIUM: Korean Hardcoded Text

**Locations**:
- `hierarchical-todo-list.tsx:104`: "실행 중..."
- `hierarchical-todo-list.tsx:111`: "결과 없음"
- `hierarchical-todo-list.tsx:193-196`: "생성 중...", "출력 없음"
- `hierarchical-todo-list.tsx:393`: "진행 중"

### LOW: Magic Numbers

**Location**: `hierarchical-todo-list.tsx:338`

```typescript
const MAX_HEIGHT = 300;
```

**Problem**: Hardcoded height without configuration option

## Refactoring Opportunities

### 1. Remove Barrel Export

**Current**: `streaming/index.ts` re-exports all components

**Proposed**: Direct imports where needed:
```typescript
// Instead of:
import { HierarchicalTodoList, ActiveTasksList } from "./streaming";

// Use:
import { HierarchicalTodoList } from "./streaming/hierarchical-todo-list";
import { ActiveTasksList } from "./streaming/active-task";
```

**Benefit**: Tree-shakeable imports

**Vercel Best Practice**: `bundle-barrel-exports`

### 2. Replace framer-motion with CSS Transitions

**Current**: Heavy animation library for expand/collapse

**Proposed**: Use CSS-based animations:
```typescript
// Tailwind CSS approach
<div className={cn(
  "overflow-hidden transition-[max-height] duration-200",
  isExpanded ? "max-h-[1000px]" : "max-h-0"
)}>
```

Or use `@radix-ui/react-collapsible` which is lighter.

**Benefit**: ~150KB bundle reduction

### 3. Memoize Recursive Components

**Current**: `HierarchicalTodoItemComponent` not memoized

**Proposed**:
```typescript
const HierarchicalTodoItemComponent = memo(function HierarchicalTodoItemComponent({
  item,
  depth,
  // ...
}: Props) {
  // ...
}, (prevProps, nextProps) => {
  // Custom comparison for nested structures
  return prevProps.item === nextProps.item &&
         prevProps.isExpanded === nextProps.isExpanded;
});
```

**Benefit**: Prevent cascade re-renders

**Vercel Best Practice**: `rerender-memo`

### 4. Virtualize Long TODO Lists

**Current**: All TODOs rendered, fixed max-height with scroll

**Proposed**: Use `@tanstack/react-virtual`:
```typescript
const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => 40,  // Estimated item height
});
```

**Benefit**: Smooth scrolling with 100+ TODOs

**Vercel Best Practice**: `rerender-virtualization`

### 5. React Query for LangSmith

**Current**: Custom polling in `useLangSmithRuns`

**Proposed**:
```typescript
const { data: runs } = useQuery({
  queryKey: ["langsmith-runs", threadId],
  queryFn: () => fetchLangSmithRuns(threadId),
  refetchInterval: isStreaming ? 2000 : false,
  staleTime: 1000,  // Deduplicate rapid requests
});
```

**Benefit**: Caching, deduplication, automatic cleanup

### 6. Lazy Load ExecutionTimelinePanel

**Current**: Always imported (394 lines)

**Proposed**: Dynamic import when LangSmith is enabled:
```typescript
const ExecutionTimelinePanel = dynamic(
  () => import("./execution-timeline-panel"),
  { ssr: false }
);

// Only render when sidebar is open AND LangSmith is configured
{sidebarOpen && langSmithEnabled && (
  <ExecutionTimelinePanel ... />
)}
```

**Benefit**: Skip 394 lines when not needed

**Vercel Best Practice**: `bundle-dynamic-import`

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| HIGH | Barrel export pattern | Small | Bundle size |
| HIGH | framer-motion (~150KB) | Medium | Bundle size |
| MEDIUM | Recursive component re-renders | Medium | Performance |
| MEDIUM | LangSmith polling | Small | API efficiency |
| LOW | Hardcoded text | Small | Internationalization |
| LOW | Magic numbers | Small | Configurability |
