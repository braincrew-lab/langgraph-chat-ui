export interface MiddlewareTraceEvent {
  middleware: string;
  hook: string;
  status: "running" | "completed" | "error";
  error?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface MiddlewareTrace {
  middleware: string;
  hooks: {
    hook: string;
    status: "running" | "completed" | "error";
    error?: string;
    timestamp: number;
  }[];
}

// 이벤트를 미들웨어별로 그룹화
export function groupTracesByMiddleware(
  events: MiddlewareTraceEvent[]
): MiddlewareTrace[] {
  const grouped = new Map<string, MiddlewareTrace>();

  for (const event of events) {
    if (!grouped.has(event.middleware)) {
      grouped.set(event.middleware, {
        middleware: event.middleware,
        hooks: [],
      });
    }

    const trace = grouped.get(event.middleware)!;

    // 같은 hook의 기존 항목 찾기
    const existingHookIndex = trace.hooks.findIndex(
      (h) => h.hook === event.hook
    );

    if (existingHookIndex >= 0) {
      // 기존 hook 상태 업데이트
      trace.hooks[existingHookIndex] = {
        hook: event.hook,
        status: event.status,
        error: event.error,
        timestamp: event.timestamp,
      };
    } else {
      // 새 hook 추가
      trace.hooks.push({
        hook: event.hook,
        status: event.status,
        error: event.error,
        timestamp: event.timestamp,
      });
    }
  }

  return Array.from(grouped.values());
}
