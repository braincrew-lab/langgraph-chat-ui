# Thread Management

## Overview

Thread Management handles conversation persistence, history display, thread switching, and CRUD operations. Threads are stored server-side via the LangGraph SDK and displayed in a sidebar with search, edit, and delete capabilities. Thread state is synchronized via URL query parameters.

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/providers/Thread.tsx` | 75 | Thread context provider, thread fetching |
| `src/hooks/useThreads.ts` | 11 | Hook to access ThreadContext |
| `src/components/thread/history/index.tsx` | 94 | Main history component with responsive layout |
| `src/components/thread/history/components/DesktopSidebar.tsx` | 83 | Desktop sidebar layout |
| `src/components/thread/history/components/MobileSidebar.tsx` | ~100 | Mobile sheet-based sidebar |
| `src/components/thread/history/components/ThreadList.tsx` | 41 | Thread list rendering |
| `src/components/thread/history/components/thread-item/index.tsx` | ~80 | Thread item with edit/delete |
| `src/components/thread/history/hooks/useThreadOperations.ts` | 57 | Thread CRUD operations |
| `src/components/thread/history/utils/threadHelpers.ts` | 43 | Thread display text extraction |

## Data Flow

### Thread Context Flow

```
ThreadProvider
├─ apiUrl, assistantId (from URL params or env vars)
├─ threads: Thread[] (state)
├─ getThreads() → LangGraph SDK → threads.search()
└─ setThreads() (state setter)
         ↓
useThreads() hook
         ↓
ThreadHistory component
├─ Loads threads on mount
├─ Manages chatHistoryOpen URL param
└─ Responsive: Desktop vs Mobile sidebar
         ↓
ThreadList / ThreadItem
├─ Display thread title (metadata.title || first message || ID)
├─ Active thread highlighting (threadId URL param)
└─ Edit/Delete operations
```

### URL State Synchronization

```typescript
// Key URL parameters managed by Thread Management
const [threadId, setThreadId] = useQueryState("threadId");
const [chatHistoryOpen, setChatHistoryOpen] = useQueryState("chatHistoryOpen");
```

| Parameter | Purpose | Default |
|-----------|---------|---------|
| `threadId` | Active thread ID | `null` |
| `chatHistoryOpen` | Sidebar visibility | From config |

## Logic Analysis

### Thread Search Metadata (`Thread.tsx:26-34`)

```typescript
function getThreadSearchMetadata(assistantId: string) {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };  // UUID → specific assistant
  } else {
    return { graph_id: assistantId };      // Non-UUID → graph ID
  }
}
```

**Logic**: Distinguishes between:
- UUID-style assistant ID → searches by `assistant_id`
- Non-UUID (e.g., "agent") → searches by `graph_id`

### Thread Display Text (`threadHelpers.ts:8-32`)

Priority order for thread title:
1. `thread.metadata.title` (custom user-set title)
2. First message content (via `getContentString`)
3. `thread.thread_id` (fallback)

### Thread Operations (`useThreadOperations.ts`)

**Delete Thread**:
1. Call `client.threads.delete(threadId)`
2. Show success toast
3. Refresh thread list
4. If deleted thread was active, reset `threadId` to `null`

**Update Title**:
1. Call `client.threads.update(threadId, { metadata: { title } })`
2. Show success toast
3. Refresh thread list

### Thread Loading (`history/index.tsx:33-51`)

```typescript
useEffect(() => {
  if (!finalApiUrl || !finalAssistantId) return;
  setThreadsLoading(true);
  getThreads()
    .then(setThreads)
    .catch((error) => {
      setThreads([]);  // Clean empty state on error
    })
    .finally(() => setThreadsLoading(false));
}, [finalApiUrl, finalAssistantId, ...]);
```

**Note**: Threads loaded when `apiUrl` AND `assistantId` are available.

## Potential Issues

### HIGH: No Pagination for Thread List

**Location**: `Thread.tsx:50-55`

```typescript
const threads = await client.threads.search({
  metadata: { ... },
  limit: 100,
});
```

**Problem**: Fixed limit of 100 threads. Users with more threads won't see older ones.

**Impact**: Loss of access to old conversations

**Recommendation**: Implement infinite scroll or pagination

### HIGH: Thread List Refetch on Every Operation

**Location**: `useThreadOperations.ts:22-23`, `44-45`

```typescript
const updatedThreads = await getThreads();
setThreads(updatedThreads);
```

**Problem**: After delete or update, entire thread list is re-fetched. This is inefficient for large lists.

**Impact**: Network overhead, potential UI flickering

**Recommendation**: Optimistic updates with local state mutation

### MEDIUM: No Request Deduplication

**Location**: `Thread.tsx:46-58`

**Problem**: `getThreads()` has no caching or deduplication. Multiple components could trigger simultaneous fetches.

**Impact**: Unnecessary network requests

**Vercel Best Practice**: `async-request-deduplication`

### MEDIUM: Thread List Not Virtualized

**Location**: `ThreadList.tsx`

**Problem**: All threads rendered, no virtualization

**Impact**: Performance issues with 100+ threads

**Vercel Best Practice**: `rerender-virtualization`

### LOW: Hardcoded Text

**Location**: `DesktopSidebar.tsx:61`

```typescript
<span>사용 가이드</span>
```

**Problem**: Korean text hardcoded, not internationalized

**Impact**: Inconsistent UX for non-Korean users

## Refactoring Opportunities

### 1. Implement React Query for Thread Management

**Current**: Manual useState/useEffect with no caching

**Proposed**:
```typescript
const { data: threads, isLoading } = useQuery({
  queryKey: ["threads", apiUrl, assistantId],
  queryFn: () => client.threads.search({ ... }),
  staleTime: 30 * 1000,  // 30 seconds
});

const deleteMutation = useMutation({
  mutationFn: (threadId) => client.threads.delete(threadId),
  onMutate: async (threadId) => {
    // Optimistic update
    queryClient.setQueryData(["threads", ...], (old) =>
      old.filter(t => t.thread_id !== threadId)
    );
  },
});
```

**Benefits**:
- Request deduplication
- Automatic caching
- Optimistic updates
- Background refresh

**Vercel Best Practice**: `async-request-deduplication`, `async-optimistic-updates`

### 2. Add Infinite Scroll

**Current**: Fixed 100 thread limit

**Proposed**:
```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["threads", apiUrl, assistantId],
  queryFn: ({ pageParam = 0 }) => client.threads.search({
    metadata: { ... },
    limit: 20,
    offset: pageParam,
  }),
  getNextPageParam: (lastPage, pages) =>
    lastPage.length === 20 ? pages.length * 20 : undefined,
});
```

**Benefits**: Load threads on demand, no arbitrary limit

### 3. Virtualize Thread List

**Current**: All threads rendered

**Proposed**: Use `@tanstack/react-virtual`:
```typescript
const virtualizer = useVirtualizer({
  count: threads.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 56,  // Thread item height
});
```

**Benefits**: Smooth scrolling with 1000+ threads

**Vercel Best Practice**: `rerender-virtualization`

### 4. Thread Search/Filter

**Current**: No search capability

**Proposed**: Add search input that filters threads client-side:
```typescript
const filteredThreads = useMemo(() =>
  threads.filter(t =>
    getThreadDisplayText(t).toLowerCase().includes(search.toLowerCase())
  ),
  [threads, search]
);
```

**Benefits**: Quick access to specific threads

### 5. Consolidate URL State Management

**Current**: Multiple `useQueryState` calls spread across components

**Proposed**: Single URL state hook for thread-related params:
```typescript
function useThreadURLState() {
  return {
    threadId: useQueryState("threadId"),
    chatHistoryOpen: useQueryState("chatHistoryOpen", ...),
    // ... other params
  };
}
```

**Benefits**: Centralized state management, easier testing

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| HIGH | No pagination (100 limit) | Medium | Data access |
| HIGH | Full refetch on operations | Medium | Performance |
| MEDIUM | No request deduplication | Small | Network |
| MEDIUM | No virtualization | Medium | Performance |
| LOW | Hardcoded text | Small | UX |
