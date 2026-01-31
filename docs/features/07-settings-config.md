# Settings & Config

## Overview

Settings & Config manages application configuration through two layers: static ChatConfig (defined in code) and runtime UserSettings (persisted in localStorage). It also handles LangGraph assistant configuration including schemas, graph structure, and dynamic assistant selection.

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/providers/Settings.tsx` | 150 | User settings provider with localStorage persistence |
| `src/providers/AssistantConfig.tsx` | 310 | Assistant config, schemas, graph structure |
| `src/lib/config.ts` | 47 | ChatConfig type and loader |
| `src/configs/index.ts` | 15 | Config aggregation and export |
| `src/configs/site.ts` | ~80 | Site/branding configuration |
| `src/configs/chat-openers.ts` | ~30 | Predefined chat starter prompts |
| `src/hooks/useSettings.ts` | ~15 | Hook to access SettingsContext |
| `src/hooks/useAssistantConfig.ts` | ~15 | Hook to access AssistantConfigContext |
| `src/components/settings/SettingsDialog.tsx` | ~200 | Settings UI dialog |

## Data Flow

### Configuration Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Static ChatConfig (compile-time)               │
│ └─ src/configs/*.ts → ChatConfig interface              │
│    ├─ meta: title, description, favicon                 │
│    ├─ branding: appName, logo, chatOpeners              │
│    ├─ buttons: fileUpload, placeholder                  │
│    ├─ threads: history, deletion, titleEdit             │
│    ├─ theme: fontFamily, fontSize, colorScheme          │
│    └─ ui: autoCollapseToolCalls, chatWidth              │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: UserSettings (runtime, localStorage)           │
│ └─ SettingsProvider                                     │
│    ├─ fontFamily, fontSize, colorScheme                 │
│    ├─ autoCollapseToolCalls, chatWidth                  │
│    └─ Persisted to "agent-chat-user-settings" key       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 3: AssistantConfig (runtime, API)                 │
│ └─ AssistantConfigProvider                              │
│    ├─ config: assistant configuration                   │
│    ├─ schemas: input_schema, state_schema               │
│    ├─ graphStructure: nodes, edges                      │
│    └─ finalNodeNames: nodes leading to __end__          │
└─────────────────────────────────────────────────────────┘
```

### Settings Application Flow

```typescript
// Settings.tsx:93-120
useEffect(() => {
  const root = document.documentElement;

  // Font family → CSS variable
  root.style.setProperty("--font-family", fontFamilyMap[userSettings.fontFamily]);

  // Font size → CSS variable
  root.style.setProperty("--base-font-size", fontSizeMap[userSettings.fontSize]);

  // Color scheme → dark class toggle
  if (userSettings.colorScheme === "auto") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", isDark);
  } else {
    root.classList.toggle("dark", userSettings.colorScheme === "dark");
  }
}, [userSettings]);
```

## Logic Analysis

### AssistantConfig Fetch Sequence (`AssistantConfig.tsx:98-226`)

**Current sequential flow**:
```
1. Check if UUID → getAssistant(apiUrl, assistantId)
   │
2. If not UUID/not found → searchAssistants({graph_id: assistantId})
   │
3. getAssistant(apiUrl, resolvedAssistantId)
   │
4. getAssistantSchemas(apiUrl, assistantId)
   │
5. getAssistantGraph(apiUrl, assistantId)
```

**Problem**: 5 sequential API calls create waterfall delays

### SSR Data Hydration (`AssistantConfig.tsx:51-71`)

```typescript
const [config, setConfig] = useState<AssistantConfigType | null>(
  () => initialData?.assistant?.config ?? null
);
const [schemas, setSchemas] = useState<AssistantSchemas | null>(
  () => initialData?.schemas ?? null
);
```

**Optimization**: Initial data from server skips client-side fetches

### Settings Persistence (`Settings.tsx:44-51`)

```typescript
function saveUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
```

**Note**: Synchronous localStorage write on every settings change

## Potential Issues

### HIGH: Sequential API Waterfall

**Location**: `AssistantConfig.tsx:98-226`

**Problem**: Five sequential API calls:
1. `getAssistant` or `searchAssistants`
2. `getAssistant` (if search was needed)
3. `getAssistantSchemas`
4. `getAssistantGraph`
5. `extractAllFinalNodeNames` (synchronous)

**Impact**: Slow initial load, especially on high-latency connections

**Vercel Best Practice**: `async-parallel-requests`

### HIGH: No Caching of Assistant Data

**Location**: `AssistantConfig.tsx:72-96`, `98-226`

**Problem**:
- Assistant list fetched on every mount
- Config/schemas re-fetched when assistantId changes
- No deduplication of concurrent requests

**Impact**: Unnecessary network requests, slow navigation

**Vercel Best Practice**: `async-request-deduplication`

### MEDIUM: Hydration Mismatch Risk

**Location**: `Settings.tsx:79-90`

```typescript
useEffect(() => {
  const stored = loadUserSettings();
  setUserSettings({ ...defaults, ...stored });
}, []);
```

**Problem**: Initial render uses defaults, then updates from localStorage. Can cause layout shifts.

**Impact**: Flash of default theme before user preferences apply

### MEDIUM: CSS Variable Approach Limitations

**Location**: `Settings.tsx:93-119`

**Problem**:
- CSS variables applied via `document.documentElement.style`
- Not type-safe
- Can't be used with Tailwind JIT

**Alternative**: Consider Tailwind config or CSS-in-JS

### LOW: Verbose Console Logging

**Location**: Throughout `AssistantConfig.tsx`

```typescript
console.log("[AssistantConfig] fetchConfig called with:", {...});
console.log("[AssistantConfig] Checking if UUID:", ...);
// Many more...
```

**Problem**: Production console noise

**Recommendation**: Use proper logging library with levels

## Refactoring Opportunities

### 1. Parallelize Assistant API Calls

**Current**: Sequential waterfall

**Proposed**: Parallel fetching after ID resolution:
```typescript
const fetchConfig = useCallback(async () => {
  // Step 1: Resolve assistant ID (sequential if needed)
  const actualAssistantId = await resolveAssistantId(initialAssistantId);

  // Step 2: Parallel fetch all data
  const [assistant, schemas, graph] = await Promise.all([
    getAssistant(apiUrl, actualAssistantId, apiKey),
    getAssistantSchemas(apiUrl, actualAssistantId, apiKey),
    getAssistantGraph(apiUrl, actualAssistantId, apiKey),
  ]);

  setConfig(assistant.config);
  setSchemas(schemas);
  setGraphStructure(graph);
  setFinalNodeNames(extractAllFinalNodeNames(graph));
}, [...]);
```

**Benefit**: 3x faster load (3 parallel vs 5 sequential)

**Vercel Best Practice**: `async-parallel-requests`

### 2. React Query for Assistant Data

**Current**: Manual useState/useEffect

**Proposed**:
```typescript
const { data: assistant } = useQuery({
  queryKey: ["assistant", assistantId],
  queryFn: () => getAssistant(apiUrl, assistantId, apiKey),
  staleTime: 5 * 60 * 1000,  // 5 minutes
});

const { data: schemas } = useQuery({
  queryKey: ["assistant-schemas", assistantId],
  queryFn: () => getAssistantSchemas(apiUrl, assistantId, apiKey),
  enabled: !!assistantId,
  staleTime: 5 * 60 * 1000,
});
```

**Benefits**:
- Automatic caching
- Request deduplication
- Background refetch
- Optimistic updates

**Vercel Best Practice**: `async-request-deduplication`

### 3. Server-Side Settings Sync

**Current**: localStorage only (client-side)

**Proposed**: Cookie-based settings for SSR:
```typescript
// On settings change
const updateUserSettings = (settings) => {
  saveUserSettings(settings);  // localStorage
  document.cookie = `settings=${JSON.stringify(settings)}; path=/`;  // Cookie
};

// In server component
const settings = cookies().get("settings")?.value;
```

**Benefit**: No flash of default theme

### 4. Tailwind Dark Mode Integration

**Current**: Manual `classList.toggle("dark")`

**Proposed**: Use Tailwind's dark mode class strategy:
```typescript
// tailwind.config.ts
darkMode: "class";

// Apply immediately in _document or layout
<html className={colorScheme === "dark" ? "dark" : ""}>
```

### 5. Remove Console Logs

**Current**: Many `console.log` statements

**Proposed**: Use conditional logging:
```typescript
const log = process.env.NODE_ENV === "development"
  ? console.log.bind(console, "[AssistantConfig]")
  : () => {};

log("fetchConfig called with:", {...});
```

Or use a logging library with levels.

### 6. Type-Safe Config with Zod

**Current**: Interface-based typing only

**Proposed**: Runtime validation:
```typescript
import { z } from "zod";

const ChatConfigSchema = z.object({
  meta: z.object({
    title: z.string(),
    description: z.string(),
  }),
  // ...
});

export function loadConfig(): ChatConfig {
  const raw = fullConfig;
  return ChatConfigSchema.parse(raw);  // Throws on invalid config
}
```

**Benefit**: Catch config errors at runtime

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| HIGH | Sequential API waterfall | Medium | Load time |
| HIGH | No caching | Medium | Performance |
| MEDIUM | Hydration mismatch | Small | UX |
| MEDIUM | CSS variable limitations | Medium | Maintainability |
| LOW | Console log noise | Small | Production cleanliness |
