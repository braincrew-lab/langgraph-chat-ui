# Agent Inbox

## Overview

Agent Inbox handles Human-in-the-Loop (HITL) interrupts from LangGraph agents. When an agent requests human input (approval, edits, response, or ignore), the inbox displays an interactive UI for the user to provide feedback. It supports multiple response types, state inspection, and integration with LangSmith Studio.

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/components/thread/agent-inbox/index.tsx` | 58 | Main ThreadView component with side panel toggle |
| `src/components/thread/agent-inbox/types.ts` | 73 | Type definitions for interrupts, responses, threads |
| `src/components/thread/agent-inbox/utils.ts` | 222 | Utility functions for formatting and response creation |
| `src/components/thread/agent-inbox/components/thread-actions-view.tsx` | 174 | Primary interrupt actions UI |
| `src/components/thread/agent-inbox/components/inbox-item-input.tsx` | ~250 | Form inputs for different response types |
| `src/components/thread/agent-inbox/components/state-view.tsx` | ~150 | Thread state/description viewer |
| `src/components/thread/agent-inbox/hooks/use-interrupted-actions.tsx` | 307 | Core interrupt handling logic |

## Data Flow

### Interrupt Handling Flow

```
LangGraph Agent
    │
    ├─ interrupt(HumanInterrupt)
    │   ├─ action_request: { action, args }
    │   ├─ description: string
    │   └─ config: { allow_accept, allow_edit, allow_respond, allow_ignore }
    │
    ↓
ThreadView (index.tsx)
    │
    ├─ Parse interrupt object
    ├─ Toggle side panel (state/description)
    │
    ↓
ThreadActionsView
    │
    ├─ useInterruptedActions() hook
    │   ├─ createDefaultHumanResponse() → HumanResponseWithEdits[]
    │   ├─ handleSubmit() → thread.submit({ command: { resume } })
    │   ├─ handleIgnore() → thread.submit({ command: { resume: [ignore] } })
    │   └─ handleResolve() → thread.submit({ command: { goto: END } })
    │
    ↓
InboxItemInput
    ├─ Accept button (if allow_accept)
    ├─ Edit fields (if allow_edit)
    ├─ Response textarea (if allow_respond)
    └─ Ignore button (if allow_ignore)
```

### Response Type Priority

The `createDefaultHumanResponse` function (`utils.ts:82-186`) determines the default submit type:

```
Priority: accept > response > edit
```

| Config | Default Type | Available Actions |
|--------|-------------|-------------------|
| `allow_accept: true` | `accept` | Accept, Edit, Respond |
| `allow_respond: true` | `response` | Respond, Edit |
| `allow_edit: true` | `edit` | Edit |
| `allow_ignore: true` | - | Ignore (always available if set) |

## Logic Analysis

### HumanInterrupt Structure (`types.ts`)

```typescript
// From @langchain/langgraph/prebuilt
interface HumanInterrupt {
  action_request: {
    action: string;      // Action name (displayed as title)
    args: Record<string, unknown>;  // Editable arguments
  };
  description?: string;   // Context for the human
  config: {
    allow_accept: boolean;   // Can approve as-is
    allow_edit: boolean;     // Can modify args
    allow_respond: boolean;  // Can provide text response
    allow_ignore: boolean;   // Can skip/ignore
  };
}
```

### Resume Commands (`use-interrupted-actions.tsx:83-98, 256-264`)

**Submit response**:
```typescript
thread.submit({}, {
  command: {
    resume: [{ type: "accept" | "edit" | "response", args: ... }]
  }
});
```

**Mark as resolved** (skip to end):
```typescript
import { END } from "@langchain/langgraph/web";

thread.submit({}, {
  command: {
    goto: END
  }
});
```

### Edit Detection (`utils.ts:205-221`)

```typescript
function haveArgsChanged(
  args: unknown,
  initialValues: Record<string, string>
): boolean {
  return Object.entries(currentValues).some(([key, value]) => {
    const valueString = typeof value === "string" ? value : JSON.stringify(value);
    return initialValues[key] !== valueString;
  });
}
```

Used to determine if user made edits (affects whether to send `accept` or `edit` response).

## Potential Issues

### HIGH: Implicit Accept on No Edits

**Location**: `use-interrupted-actions.tsx:123-136`

```typescript
if (r.type === "edit") {
  if (r.acceptAllowed && !r.editsMade) {
    return { type: "accept", args: r.args };  // ← Implicit accept
  } else {
    return { type: "edit", args: r.args };
  }
}
```

**Problem**: If user opens edit view but doesn't change anything, clicking submit sends `accept` instead of `edit`.

**Impact**: Potentially unexpected behavior if user intended to review and approve edits

### MEDIUM: Loading State Race Condition

**Location**: `use-interrupted-actions.tsx:163-170, 206-220`

```typescript
setLoading(true);
setStreaming(true);
const resumedSuccessfully = resumeRun([input]);
// ...
setLoading(false);  // ← Set before async completes
```

**Problem**: `setLoading(false)` called before stream actually completes

**Impact**: UI may show ready state while stream is still processing

### MEDIUM: No Loading Indicator on State View

**Location**: `components/state-view.tsx`

**Problem**: When switching to state view, no loading state while fetching thread values

**Impact**: May show stale data briefly

### LOW: Hardcoded Studio URL

**Location**: `utils.ts:188-203`

```typescript
const smithStudioURL = new URL("https://smith.langchain.com/studio/thread");
```

**Problem**: Hardcoded LangSmith URL, no support for self-hosted instances

### LOW: Console Errors

**Location**: `utils.ts:115-123`, `use-interrupted-actions.tsx:79`

```typescript
console.error("KEY AND VALUE FOUND IN initialHumanInterruptEditValue.current...");
console.error("Error formatting and setting human response state", e);
```

**Problem**: Console errors in production for edge cases

## Refactoring Opportunities

### 1. Extract Response Builder Logic

**Current**: `createDefaultHumanResponse` is 104 lines with mixed concerns

**Proposed**: Split into focused functions:
```typescript
// Separate responsibilities
function parseAllowedActions(config: InterruptConfig): AllowedActions;
function buildResponseOptions(interrupt: HumanInterrupt, allowed: AllowedActions): HumanResponseWithEdits[];
function determineDefaultSubmitType(responses: HumanResponseWithEdits[], config: InterruptConfig): SubmitType;
```

### 2. React Query for Thread State

**Current**: Thread values passed via context

**Proposed**: Fetch thread state with React Query for better caching:
```typescript
const { data: threadState, isLoading } = useQuery({
  queryKey: ["thread-state", threadId],
  queryFn: () => client.threads.getState(threadId),
  staleTime: 10 * 1000,
});
```

### 3. Fix Loading State Management

**Current**: Manual loading state with race conditions

**Proposed**: Use state machine or proper async handling:
```typescript
const [state, dispatch] = useReducer(interruptReducer, initialState);

// States: idle | submitting | streaming | success | error
// Transitions handled atomically
```

### 4. Configurable Studio URL

**Current**: Hardcoded LangSmith URL

**Proposed**: Add configuration option:
```typescript
// config.ts
const config = {
  langsmith: {
    studioBaseUrl: process.env.LANGSMITH_STUDIO_URL || "https://smith.langchain.com",
  },
};
```

### 5. Internationalization

**Current**: English strings hardcoded throughout

**Proposed**: Use i18n library:
```typescript
// Current
toast("Success", { description: "Response submitted successfully." });

// Proposed
toast(t("inbox.success"), { description: t("inbox.responseSubmitted") });
```

### 6. Memoize Response Options

**Current**: `createDefaultHumanResponse` called in useEffect on every interrupt change

**Proposed**: Memoize based on interrupt config:
```typescript
const responseOptions = useMemo(() =>
  createDefaultHumanResponse(interrupt, initialHumanInterruptEditValue),
  [interrupt.config]  // Only config affects options
);
```

### 7. Add Optimistic UI Updates

**Current**: Wait for stream completion to update UI

**Proposed**: Optimistic updates for immediate feedback:
```typescript
const submitResponse = useMutation({
  mutationFn: (response) => thread.submit({}, { command: { resume: response } }),
  onMutate: () => {
    // Optimistically mark as processing
    setLocalStatus("processing");
  },
  onError: () => {
    // Rollback on error
    setLocalStatus("interrupted");
  },
});
```

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| HIGH | Implicit accept behavior | Small | UX clarity |
| MEDIUM | Loading state race condition | Medium | UI consistency |
| MEDIUM | No loading on state view | Small | UX |
| LOW | Hardcoded Studio URL | Small | Flexibility |
| LOW | Console errors in production | Small | Cleanliness |
