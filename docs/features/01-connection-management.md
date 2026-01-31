# Connection Management

## Overview

Connection Management handles how the application connects to LangGraph servers. Users can configure multiple connections (different LangGraph instances) and switch between them. The system supports environment variable-based defaults, URL parameters, localStorage persistence, and cookie-based storage for SSR support.

## File Map

| File | Role |
|------|------|
| `src/lib/connections.ts` | Core connection CRUD operations and localStorage persistence |
| `src/lib/connection-cookies.ts` | Cookie-based storage for SSR support |
| `src/providers/client.ts` | LangGraph SDK client factory |
| `src/providers/Stream.tsx` | Connection parameter resolution and initialization |
| `src/components/settings/ConnectionList.tsx` | UI for managing saved connections |

## Data Flow

### Connection Resolution Priority

```
URL Parameters → Environment Variables → Default Values
     ↓
  localStorage (custom connections)
     ↓
  Cookies (SSR sync)
```

### State Flow

1. **Initialization** (`Stream.tsx:345-395`)
   - Read `apiUrl` and `assistantId` from URL query params
   - Fall back to `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ASSISTANT_ID` env vars
   - API key loaded from localStorage (`lg:chat:apiKey`)
   - Sync active connection to cookies for SSR

2. **Connection Switching** (`ConnectionList.tsx:103-128`)
   - Update localStorage via `switchConnection()`
   - Update URL params
   - Save API key to localStorage
   - Page reload to apply changes

3. **SSR Support** (`connection-cookies.ts`)
   - Active connection synced to cookies
   - Server can read connection details via `parseConnectionCookies()`
   - Enables server-side schema fetching

## Logic Analysis

### Correctness Verification

**Connection ID Generation** (`connections.ts:80-81`)
```typescript
id: `conn-${Date.now()}`
```
- Uses timestamp-based IDs
- Collision risk: Low (millisecond precision)
- Not crypto-random, but sufficient for local storage

**Active Connection Resolution** (`connections.ts:112-127`)
```typescript
if (storage.activeConnectionId === "default") {
  return defaultConn;
}
const activeConn = storage.connections.find(
  (c) => c.id === storage.activeConnectionId
);
return activeConn || defaultConn;
```
- Fallback to default if active connection not found
- Handles deleted connections gracefully

### Edge Cases

1. **Missing localStorage** (`connections.ts:37-42`)
   - SSR safety check: `typeof window === "undefined"`
   - Returns empty connections with "default" as active

2. **Invalid stored JSON** (`connections.ts:52-59`)
   - Try-catch with fallback to empty state
   - Silently logs error, doesn't crash

3. **Deleted active connection** (`connections.ts:103-108`)
   - Automatically switches to "default" when active connection is deleted

4. **Empty API URL** (`ConnectionList.tsx:61-64`)
   - Validation prevents adding connections without URL

## Potential Issues

### Bug: Page Reload on Connection Switch

**Location**: `ConnectionList.tsx:125-128`

```typescript
setTimeout(() => {
  window.location.href = url.toString();
}, 500);
```

**Problem**: Full page reload loses all in-memory state. This is intentional but disruptive UX.

**Impact**: Medium - User experience is jarring, but functional

### Bug: API Key Duplication

**Location**: `ConnectionList.tsx:117-120` and `Stream.tsx:362`

```typescript
// ConnectionList.tsx
localStorage.setItem("lg:chat:apiKey", connection.apiKey);

// Stream.tsx
window.localStorage.setItem("lg:chat:apiKey", envApiKey);
```

**Problem**: API key stored in two places:
1. Per-connection in `lg:connections` storage
2. Globally in `lg:chat:apiKey`

**Impact**: Low - Works but inconsistent data model

### Performance: Synchronous localStorage Reads

**Location**: `connections.ts:44-52`, `Stream.tsx:358-366`

**Problem**: Multiple synchronous `localStorage.getItem()` calls during render

**Impact**: Low - localStorage is fast, but blocks main thread

### Technical Debt: No Request Deduplication

**Location**: `ConnectionList.tsx:33-43`

```typescript
const validateLangGraphUrl = async (apiUrl: string, apiKey?: string): Promise<boolean> => {
  const res = await fetch(`${url}/info`, {...});
  return res.ok;
}
```

**Problem**: No caching or deduplication of validation requests

**Impact**: Low - Only called on user action (add connection)

## Refactoring Opportunities

### 1. URL Normalization Consolidation

**Current State**: URL normalization in multiple places:
- `client.ts:3-22`: `normalizeApiUrl()` function
- `ConnectionList.tsx:35`: Inline `apiUrl.replace(/\/$/, "")`

**Recommendation**: Use single normalization function everywhere

**Vercel Best Practice**: `bundle-minimize-duplication`

### 2. Consider React Query for Connection Validation

**Current State**: Manual fetch with local loading state

**Recommendation**: Use React Query for:
- Automatic request deduplication
- Caching validation results
- Better error handling

**Vercel Best Practice**: `async-request-deduplication`

### 3. Client-side Navigation Instead of Page Reload

**Current State**: Full page reload on connection switch

**Recommendation**:
- Use Next.js router for navigation
- Invalidate relevant queries/state
- Better UX with transitions

**Vercel Best Practice**: `rerender-client-navigation`

### 4. Unified Storage Strategy

**Current State**: Mix of:
- localStorage for full connection list
- Cookies for SSR sync
- Separate localStorage key for API key

**Recommendation**:
- Consider using a single source of truth
- Or clearly document the dual-storage pattern
- Ensure consistency between storages

### 5. Type-safe Cookie Handling

**Current State**: Manual string parsing in `parseConnectionCookies()`

**Recommendation**: Use Next.js `cookies()` API consistently:

```typescript
// Server-side
import { cookies } from 'next/headers';
const apiUrl = cookies().get(CONNECTION_COOKIE_NAMES.apiUrl);
```

## Summary

The Connection Management system is well-structured with good SSR support. Key areas for improvement:

| Priority | Issue | Effort |
|----------|-------|--------|
| Low | URL normalization consolidation | Small |
| Low | API key storage consistency | Small |
| Medium | Client-side navigation on switch | Medium |
| Low | React Query for validation | Small |
