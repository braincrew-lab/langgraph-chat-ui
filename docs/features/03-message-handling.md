# Message Handling

## Overview

Message Handling manages the display, rendering, and interaction of chat messages including human input, AI responses, tool calls, tool results, and interrupt states. It supports multimodal content, markdown rendering, code syntax highlighting, branch switching, and message editing.

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/components/thread/messages/ai.tsx` | 266 | AI message display with tool calls and interrupts |
| `src/components/thread/messages/human.tsx` | 151 | Human message display with editing capability |
| `src/components/thread/messages/tool-calls.tsx` | 329 | Tool call and result rendering |
| `src/components/thread/messages/shared.tsx` | 222 | Branch switcher and command bar components |
| `src/components/thread/messages/generic-interrupt.tsx` | ~100 | Generic interrupt view for non-inbox interrupts |
| `src/components/thread/markdown-text.tsx` | 261 | Markdown rendering with code highlighting |
| `src/components/thread/syntax-highlighter.tsx` | ~50 | Code syntax highlighting (lazy loaded) |
| `src/components/thread/utils.ts` | 307 | Message filtering and subagent detection |

## Data Flow

### Message Rendering Pipeline

```
Messages (from StreamContext)
         ↓
filterMessages()
├─ Remove DO_NOT_RENDER_ID_PREFIX messages
├─ Build subagent context
├─ Apply compact view filtering
└─ Detect last main agent message
         ↓
shouldRenderMessage()
├─ Check todoLifecycle state
├─ Detect subagent messages
└─ Filter by message type
         ↓
┌─────────────────────────────────────────┐
│ Message Components                       │
│ ├─ HumanMessage (type: "human")         │
│ ├─ AssistantMessage (type: "ai")        │
│ │   ├─ MarkdownText (content)           │
│ │   ├─ ToolCalls (tool_calls)           │
│ │   ├─ CustomComponent (ui components)  │
│ │   └─ Interrupt (threadInterrupt)      │
│ └─ ToolResult (type: "tool")            │
└─────────────────────────────────────────┘
```

### Subagent Detection Flow

```typescript
// utils.ts:127-188
isSubagentMessage(message, context, messages)
  │
  ├─ Tool message with name="task" → true
  ├─ AI message with Task/Todo call → false (main agent)
  ├─ Context.subagentMessageIds has ID → true
  ├─ Position after active Task call → true
  ├─ Active Tasks + no tool_calls → true
  └─ Message has node name → true
```

## Logic Analysis

### Message Type Handling (`ai.tsx:110-253`)

The `AssistantMessage` component handles multiple message types:

1. **Tool Results** (`message.type === "tool"`)
   - Renders `ToolResult` component
   - Hidden in compact view or when `hideToolCalls` is set
   - Task/Todo tool results hidden (displayed in TODO box)

2. **AI Messages** with content and/or tool calls
   - Content rendered via `MarkdownText`
   - Tool calls via `ToolCalls` component
   - Custom UI components via `LoadExternalComponent`
   - Interrupts handled by `Interrupt` component

**Integrated Tool Filtering** (`ai.tsx:144-149`):
```typescript
const filterIntegratedTools = (toolCalls) => {
  return toolCalls?.filter(tc => {
    const name = tc.name?.toLowerCase() || "";
    return name !== "task" && !name.includes("todo");
  });
};
```

### Message Editing (`human.tsx:53-73`)

Human messages support inline editing:
1. User clicks edit button → `setIsEditing(true)`
2. `EditableContent` renders with current content
3. Cmd/Ctrl+Enter submits the edit
4. Edit submits with `parentCheckpoint` for branching
5. Optimistic update via `optimisticValues`

### Anthropic Tool Call Parsing (`ai.tsx:58-82`)

Handles Anthropic-style streamed tool calls:
```typescript
function parseAnthropicStreamedToolCalls(content: MessageContentComplex[]) {
  const toolCallContents = content.filter(isToolUseContent);
  return toolCallContents.map(tc => ({
    name: tc.name ?? "",
    id: tc.id,
    args: parsePartialJson(tc.input) ?? {},
    type: "tool_call"
  }));
}
```

### Subagent Context Building (`utils.ts:31-110`)

Builds context for detecting subagent messages:
1. Collects all Task tool call IDs and result indices
2. Identifies active (incomplete) Task calls
3. Marks messages between Task call and result as subagent

## Potential Issues

### HIGH: Heavy Markdown Dependencies

**Location**: `markdown-text.tsx:1-16`

```typescript
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";
```

**Problem**: These libraries add significant bundle size:
- `react-markdown`: ~50KB
- `rehype-katex` + `katex`: ~300KB (CSS + fonts)
- `remark-gfm`: ~20KB

**Impact**: Large initial bundle, even when math support isn't needed

**Vercel Best Practice**: `bundle-dynamic-import`, `bundle-minimize-bundle-size`

### HIGH: framer-motion Full Import

**Location**: `tool-calls.tsx:3`, `shared.tsx:12`

```typescript
import { motion, AnimatePresence } from "framer-motion";
```

**Problem**: Full framer-motion import (~150KB) for simple expand/collapse animations

**Impact**: Significant bundle overhead

**Vercel Best Practice**: `bundle-minimize-bundle-size`

### MEDIUM: Synchronous JSON Parsing in Render

**Location**: `ai.tsx:66-73`

```typescript
const parsedInput = typeof tc.input === "string"
  ? parsePartialJson(tc.input)
  : tc.input;
```

**Problem**: `parsePartialJson` called during render for streaming partial JSON

**Impact**: Potential frame drops during rapid streaming

### MEDIUM: Message Filtering Complexity

**Location**: `utils.ts:273-306`

```typescript
export function filterMessages(messages, options) {
  const context = subagentContext ?? buildSubagentContext(filtered);
  // Multiple iterations over messages...
}
```

**Problem**: `buildSubagentContext` is O(n²) - iterates messages, then for each Task, iterates again

**Impact**: Slow for long conversations with many messages

### LOW: Missing memo on ToolCallItem

**Location**: `tool-calls.tsx:30-137`

**Problem**: `ToolCallItem` is not memoized, re-renders on parent changes

**Impact**: Minor - small component, but could be optimized

### LOW: Inline Component Definitions

**Location**: `markdown-text.tsx:63-244`

```typescript
const defaultComponents: Record<string, unknown> = {
  h1: ({ className, ...props }) => <h1 className={...} {...props} />,
  // ... many more
};
```

**Problem**: Object created on every import, not memoized per render

**Impact**: Minor - object is stable across renders

## Refactoring Opportunities

### 1. Lazy Load Markdown Dependencies

**Current**: All markdown/katex loaded upfront

**Proposed**:
```typescript
const MarkdownText = dynamic(() => import("./markdown-text"), {
  loading: () => <div className="animate-pulse">...</div>,
  ssr: false
});
```

**Benefit**: Defer ~400KB until first markdown message renders

**Vercel Best Practice**: `bundle-dynamic-import`

### 2. Replace framer-motion with CSS/Tailwind

**Current**: Full framer-motion for expand/collapse

**Proposed**: Use Tailwind CSS transitions:
```tsx
<div className={cn(
  "overflow-hidden transition-all duration-300",
  isExpanded ? "max-h-[500px]" : "max-h-0"
)}>
```

**Benefit**: Remove ~150KB dependency

**Vercel Best Practice**: `bundle-minimize-bundle-size`

### 3. Optimize Subagent Detection

**Current**: O(n²) complexity

**Proposed**: Single-pass algorithm with index maps:
```typescript
function buildSubagentContextOptimized(messages: Message[]) {
  const taskRanges = new Map<string, [number, number]>();
  // Single pass to build ranges
  for (let i = 0; i < messages.length; i++) {
    // Build index maps
  }
  // Return with pre-computed Sets
}
```

**Benefit**: O(n) complexity

### 4. Memoize Leaf Components

**Current**: Some components lack memoization

**Proposed**:
```typescript
const ToolCallItem = memo(function ToolCallItem({...}) {
  // ...
});
```

**Benefit**: Prevent unnecessary re-renders

**Vercel Best Practice**: `rerender-memo`

### 5. Consider KaTeX Optional Loading

**Current**: KaTeX always loaded

**Proposed**: Load KaTeX only when math content detected:
```typescript
const hasKatex = content.includes("$$") || content.includes("\\[");
if (hasKatex) {
  await import("katex/dist/katex.min.css");
}
```

**Benefit**: Skip ~300KB for non-math content

### 6. Virtualize Long Tool Results

**Current**: All tool result content rendered

**Proposed**: Use virtualization for long JSON results:
- Collapse by default
- Lazy render expanded content
- Paginate large arrays

**Vercel Best Practice**: `rerender-virtualization`

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| HIGH | Lazy load markdown (~400KB) | Medium | Bundle size |
| HIGH | Replace framer-motion (~150KB) | Medium | Bundle size |
| MEDIUM | Optimize subagent detection | Small | Performance |
| MEDIUM | Synchronous JSON parsing | Small | UI responsiveness |
| LOW | Memoize leaf components | Small | Re-renders |
| LOW | Optional KaTeX loading | Medium | Bundle size |
