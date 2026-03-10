import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  type LangSmithRun,
  type LangSmithRunsResponse,
  filterMiddlewareRuns,
  filterToolRuns,
  filterLLMRuns,
} from "@/types/langsmith";
import { TIMING } from "@/lib/constants";

interface UseLangSmithRunsOptions {
  // 폴링 간격 (ms) - 0이면 폴링 비활성화
  pollingInterval?: number;
  // 자동 폴링 활성화 여부
  autoPolling?: boolean;
}

interface UseLangSmithRunsReturn {
  runs: LangSmithRun[];
  middlewareRuns: LangSmithRun[];
  toolRuns: LangSmithRun[];
  llmRuns: LangSmithRun[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  startPolling: () => void;
  stopPolling: () => void;
  isPolling: boolean;
}

const DEFAULT_POLLING_INTERVAL = TIMING.POLLING_INTERVAL;

export function useLangSmithRuns(
  threadId: string | null,
  traceId?: string | null,
  options: UseLangSmithRunsOptions = {},
): UseLangSmithRunsReturn {
  const { pollingInterval = DEFAULT_POLLING_INTERVAL, autoPolling = false } =
    options;

  const [runs, setRuns] = useState<LangSmithRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(autoPolling);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRuns = useCallback(async () => {
    if (!threadId && !traceId) {
      setRuns([]);
      return;
    }

    // 이전 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (threadId) params.set("threadId", threadId);
      if (traceId) params.set("traceId", traceId);

      const res = await fetch(`/api/langsmith/runs?${params.toString()}`, {
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        // Safely parse error response (may not be JSON)
        let errorMessage = `HTTP ${res.status}`;
        try {
          const contentType = res.headers.get("content-type");
          if (contentType?.includes("application/json")) {
            const errorData = await res.json();
            errorMessage = errorData.error || errorMessage;
          }
        } catch {
          // Ignore parse errors
        }
        throw new Error(errorMessage);
      }

      const data: LangSmithRunsResponse = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setRuns(data.runs || []);
    } catch (err) {
      // 취소된 요청은 에러로 처리하지 않음
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("Failed to fetch LangSmith runs:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [threadId, traceId]);

  // 폴링 시작
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      return; // 이미 폴링 중
    }

    setIsPolling(true);
    pollingIntervalRef.current = setInterval(() => {
      fetchRuns();
    }, pollingInterval);
  }, [fetchRuns, pollingInterval]);

  // 폴링 중지
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // 초기 fetch 및 threadId/traceId 변경 시 fetch
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // 자동 폴링 설정
  useEffect(() => {
    if (autoPolling && (threadId || traceId)) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [autoPolling, threadId, traceId, startPolling, stopPolling]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      stopPolling();
    };
  }, [stopPolling]);

  // 필터링된 runs (memoized to avoid recomputation on every render)
  const middlewareRuns = useMemo(() => filterMiddlewareRuns(runs), [runs]);
  const toolRuns = useMemo(() => filterToolRuns(runs), [runs]);
  const llmRuns = useMemo(() => filterLLMRuns(runs), [runs]);

  return {
    runs,
    middlewareRuns,
    toolRuns,
    llmRuns,
    loading,
    error,
    refetch: fetchRuns,
    startPolling,
    stopPolling,
    isPolling,
  };
}
