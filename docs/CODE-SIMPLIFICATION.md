# 코드 간소화 및 최적화 분석

## 개요

이 문서는 기존 리팩토링 문서([REFACTORING-SUMMARY.md](./REFACTORING-SUMMARY.md))를 보완하여, 불필요한 로직과 컴포넌트를 **제거하거나 간소화**할 수 있는 구체적인 방안을 정리합니다.

### 분석 범위
- Dead code 및 미사용 함수
- 중복 로직
- 과도한 추상화
- 미완성/불완전 기능
- 프로덕션 불필요 코드

### 예상 효과
| 항목 | 제거 가능 라인 수 |
|------|-------------------|
| Dead code | ~150줄 |
| 미사용 컴포넌트 파일 | ~500줄 (5개 파일) |
| 중복 로직 통합 | ~100줄 |
| **총계** | **~750줄** |

---

## 1. 즉시 제거 가능한 코드

### 1.1 useStreamingView.ts (Dead Code)

> 파일: `src/hooks/useStreamingView.ts` (2,954줄)

| 함수명 | 라인 | 상태 | 제거 시 영향 | 우선순위 |
|--------|------|------|-------------|----------|
| `_matchTodoToSubagent()` | 405-418 | "호환성을 위해 유지" 주석, 미사용 | 14줄 제거, 영향 없음 | 🔴 즉시 |
| `_matchTodoToSubagentImproved()` | 379-402 | "미사용 - 향후 사용 예정" 주석 | 24줄 제거, 영향 없음 | 🔴 즉시 |
| `_extractToolsFromMessages()` | 1483-1491 | "호환성 함수" 주석, wrapper만 존재 | 9줄 제거, 영향 없음 | 🔴 즉시 |
| `filterToolsByNamespace()` | 1505-1514 | "불완전함" 주석, 실제로 아무 동작 안함 | 10줄 제거, 영향 없음 | 🔴 즉시 |
| `extractNodeBasedOutputs()` | 1045-1118 | "거의 사용되지 않아야 함" 주석 | 74줄 제거, 영향 없음 | 🔴 즉시 |

**총 제거 가능: ~131줄**

#### 제거 방법

```bash
# 각 함수 검색 및 호출 여부 확인
grep -r "_matchTodoToSubagent\|_matchTodoToSubagentImproved" src/
grep -r "_extractToolsFromMessages\|filterToolsByNamespace" src/
grep -r "extractNodeBasedOutputs" src/
```

확인 후 해당 함수와 관련 주석을 삭제합니다.

---

### 1.2 useStreamingView.ts (Deprecated 코드 경로)

| 항목 | 라인 | 설명 | 제거 조건 |
|------|------|------|-----------|
| toolCallId 매칭 로직 | 1916-1930 | "구버전 호환" 주석, subagentType 매칭으로 대체됨 | subagentType 매칭이 안정적으로 동작 확인 후 |
| `buildToolCallIdIndex()` | 2038 | "deprecated, fallback용" 주석 | 위 조건과 동일 |
| `EXACT_MATCH` 상수 | 194 | 정의만 있고 사용되지 않음 | 즉시 제거 가능 |

#### 제거 전 검증 필요 사항

```typescript
// 현재 코드 (1916-1930)
// 구버전 호환: toolCallId로 매칭 시도
if (!matchedTask && subagentInfo.toolCallId) {
  // ... deprecated logic
}

// 검증: subagentType 매칭 성공률 확인
// 100% 성공 시 deprecated 코드 제거 가능
```

---

### 1.3 Stream.tsx (미사용 Setter)

> 파일: `src/providers/Stream.tsx` (410줄)

| 변수명 | 라인 | 상태 | 제거 시 영향 |
|--------|------|------|-------------|
| `_setApiUrl` | 350 | 선언만 있고 미사용 | 영향 없음 |
| `_setAssistantId` | 353 | 선언만 있고 미사용 | 영향 없음 |
| `_setApiKey` | 358 | 선언만 있고 미사용 | 영향 없음 |
| `_setApiKeyWrapper` | 368-371 | 정의만 있고 미호출 | 영향 없음 |

#### 제거 방법

```typescript
// Before
const [apiUrl, _setApiUrl] = useState<string | null>(null);
const [assistantId, _setAssistantId] = useState<string | null>(null);
const [apiKey, _setApiKey] = useState<string | null>(null);

// After
const [apiUrl] = useState<string | null>(null);
const [assistantId] = useState<string | null>(null);
const [apiKey] = useState<string | null>(null);

// _setApiKeyWrapper 함수도 삭제
```

---

### 1.4 thread/index.tsx (Dead Code)

> 파일: `src/components/thread/index.tsx` (943줄)

| 항목 | 라인 | 문제 | 제거 방법 |
|------|------|------|-----------|
| `animate` 삼항 연산자 | 435-444 | 양쪽 브랜치가 동일한 값 반환 | 삼항 연산자 제거, 단일 값으로 변경 |

```typescript
// Before (435-444)
animate={
  someCondition
    ? { opacity: 1, y: 0 }
    : { opacity: 1, y: 0 }  // 동일!
}

// After
animate={{ opacity: 1, y: 0 }}
```

---

## 2. 미사용 컴포넌트 (삭제 대상)

### 2.1 streaming/ 컴포넌트

> 파일: `src/components/thread/streaming/index.ts`에서 export되지만 import되지 않는 컴포넌트

| 컴포넌트 | 파일 | 대체된 컴포넌트 | 삭제 가능 여부 |
|----------|------|-----------------|----------------|
| `TodoList` | `todo-list.tsx` | `HierarchicalTodoList` | ✅ 삭제 가능 |
| `CompletedSummary` | `completed-summary.tsx` | 미사용 | ✅ 삭제 가능 |
| `TaskTreeItem` | `task-tree-item.tsx` | 미사용 | ✅ 삭제 가능 |
| `TaskTreeView` | `task-tree-view.tsx` | 미사용 | ✅ 삭제 가능 |
| `SubagentOutput` | `subagent-output.tsx` | 미사용 | ✅ 삭제 가능 |
| `SubagentList` | `subagent-list.tsx` | 미사용 | ✅ 삭제 가능 |
| `CurrentToolCalls` | `current-tool-calls.tsx` | 미사용 | ✅ 삭제 가능 |

#### 검증 방법

```bash
# 각 컴포넌트의 실제 사용 여부 확인
grep -r "TodoList" src/ --include="*.tsx" | grep -v "HierarchicalTodoList"
grep -r "CompletedSummary" src/ --include="*.tsx"
grep -r "TaskTreeItem\|TaskTreeView" src/ --include="*.tsx"
grep -r "SubagentOutput\|SubagentList" src/ --include="*.tsx"
grep -r "CurrentToolCalls" src/ --include="*.tsx"
```

#### 삭제 절차

1. `streaming/index.ts`에서 해당 export 제거
2. 해당 컴포넌트 파일 삭제
3. `pnpm build` 및 `pnpm lint` 실행하여 오류 없음 확인

---

## 3. 중복 코드 통합

### 3.1 Task Scope 계산 중복

3곳에서 동일한 로직이 중복됩니다:

| 위치 | 함수명 | 라인 |
|------|--------|------|
| useStreamingView.ts | `buildTaskScopes()` | ~800-850 |
| useStreamingView.ts | `extractSubagentStreamingOutput()` | ~1200-1250 |
| useStreamingView.ts | `extractToolsFromMessagesForTask()` | ~1400-1450 |

#### 통합 방안

```typescript
// Before: 3곳에서 중복
function buildTaskScopes() {
  const scope = calculateScope(task);
  // ...
}

function extractSubagentStreamingOutput() {
  const scope = calculateScope(task); // 중복!
  // ...
}

// After: 공통 유틸리티로 추출
// utils/task-scope.ts
export function calculateTaskScope(task: Task): TaskScope {
  // 공통 로직
}

// 각 함수에서 import하여 사용
import { calculateTaskScope } from "./utils/task-scope";
```

### 3.2 Parent 매칭 함수 중복

3개의 유사한 함수 중 1개만 실제 사용됩니다:

| 함수명 | 사용 여부 |
|--------|-----------|
| `_matchTodoToSubagent()` | ❌ 미사용 |
| `_matchTodoToSubagentImproved()` | ❌ 미사용 |
| `matchTodosToTasksByOrder()` | ✅ 사용 중 |

→ 상위 2개 함수 삭제 (1.1 섹션 참조)

### 3.3 thread/index.tsx 헤더 UI 중복

> 두 개의 헤더 섹션(485-527, 528-598)에 동일한 버튼/아이콘이 중복됩니다.

| 중복 항목 | 위치 1 | 위치 2 |
|-----------|--------|--------|
| 사이드바 토글 버튼 | 488-500 | 532-544 |
| 새 스레드 버튼 | ~510 | ~560 |
| 설정 버튼 | ~520 | ~580 |

#### 통합 방안

```typescript
// Before: 두 곳에서 중복
<header className="header-1">
  <SidebarToggle onClick={toggleSidebar} />
  <NewThreadButton />
  <SettingsButton />
</header>

<header className="header-2">
  <SidebarToggle onClick={toggleSidebar} />  // 중복!
  <NewThreadButton />                        // 중복!
  <SettingsButton />                         // 중복!
</header>

// After: 공통 컴포넌트로 추출
function HeaderActions({ toggleSidebar }: Props) {
  return (
    <>
      <SidebarToggle onClick={toggleSidebar} />
      <NewThreadButton />
      <SettingsButton />
    </>
  );
}

<header className="header-1">
  <HeaderActions toggleSidebar={toggleSidebar} />
</header>
```

---

## 4. 미완성/불완전 기능

### 4.1 hideToolCalls (thread/index.tsx)

> 라인 136-139

```typescript
// 현재: URL 파라미터 수집만 하고 실제 필터링 미구현
const hideToolCalls = searchParams.get("hideToolCalls");
// ... 하지만 실제로 tool call을 숨기는 로직 없음
```

#### 권장 조치
- **옵션 A**: 기능 완성 (tool call 필터링 로직 추가)
- **옵션 B**: 미사용 코드 제거

### 4.2 formSubmissions 메모리 누수 (thread/index.tsx)

> 라인 172-174

```typescript
const [formSubmissions, setFormSubmissions] = useState<Map<string, FormData>>(new Map());

// 문제: threadId 변경 시 cleanup 없음 → 메모리 누수
```

#### 수정 방안

```typescript
// threadId 변경 시 초기화
useEffect(() => {
  setFormSubmissions(new Map());
}, [threadId]);
```

### 4.3 toolCallNamespaceMap (Stream.tsx)

> 라인 66, 117-120

```typescript
// 빌드는 되지만 소비자(thread/index.tsx)에서 실제로 사용되지 않음
const toolCallNamespaceMap = useMemo(() => {
  // ... 계산 로직
}, [messages]);
```

#### 권장 조치
- 사용 계획이 없다면 제거
- 사용 예정이라면 TODO 주석 추가

---

## 5. Debug 로그 (프로덕션 제거)

### 5.1 useStreamingView.ts

| 라인 | 내용 |
|------|------|
| 1905 | `console.log("[DEBUG] matching...")` |
| 1938 | `console.log("[DEBUG] result...")` |
| 2557 | `console.log("[DEBUG] final...")` |

### 5.2 AssistantConfig.tsx

> 11개의 `[AssistantConfig]` 로그 (라인 99-217)

```typescript
console.log("[AssistantConfig] Fetching assistant...");
console.log("[AssistantConfig] Fetched schemas...");
// ... 9개 더
```

### 5.3 Stream.tsx

> 라인 145: 주석 처리된 debug 로그

```typescript
// console.log("[Stream] Processing message...");
```

#### 권장 조치

**옵션 A: 조건부 로깅**

```typescript
const DEBUG = process.env.NODE_ENV === "development";

if (DEBUG) {
  console.log("[DEBUG] ...");
}
```

**옵션 B: 전체 제거**

```bash
# 모든 debug 로그 검색
grep -rn "console.log.*\[DEBUG\]\|console.log.*\[AssistantConfig\]" src/
```

---

## 6. 정리 체크리스트

### 즉시 실행 가능 (빌드 영향 없음)

- [ ] `_matchTodoToSubagent()` 제거
- [ ] `_matchTodoToSubagentImproved()` 제거
- [ ] `_extractToolsFromMessages()` 제거
- [ ] `filterToolsByNamespace()` 제거
- [ ] `extractNodeBasedOutputs()` 제거
- [ ] `EXACT_MATCH` 상수 제거
- [ ] Stream.tsx 미사용 setter 제거
- [ ] thread/index.tsx `animate` 삼항 연산자 수정

### 검증 후 실행

- [ ] 미사용 streaming 컴포넌트 삭제 (grep으로 사용 여부 확인)
- [ ] deprecated toolCallId 매칭 로직 제거 (subagentType 매칭 안정성 확인)

### 리팩토링 필요

- [ ] Task scope 계산 로직 통합
- [ ] thread/index.tsx 헤더 UI 중복 제거
- [ ] formSubmissions 메모리 누수 수정
- [ ] hideToolCalls 기능 완성 또는 제거

### 프로덕션 준비

- [ ] Debug 로그 제거 또는 조건부 로깅으로 변경

---

## 7. 검증 방법

모든 변경 후 다음을 실행하여 검증합니다:

```bash
# 1. 빌드 성공 확인
pnpm build

# 2. 린트 오류 없음 확인
pnpm lint

# 3. 타입 체크
pnpm type-check

# 4. 수동 테스트
# - 스트리밍 기능 정상 동작
# - TODO 표시 정상 동작
# - Task 시각화 정상 동작
```

---

## 관련 문서

- [REFACTORING-SUMMARY.md](./REFACTORING-SUMMARY.md) - 전체 리팩토링 계획
- [features/02-streaming-realtime.md](./features/02-streaming-realtime.md) - 스트리밍 기능 분석
- [features/06-task-visualization.md](./features/06-task-visualization.md) - Task 시각화 분석
