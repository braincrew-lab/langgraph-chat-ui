import React, {
  createContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  isUIMessage,
  isRemoveUIMessage,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { getApiKey } from "@/lib/api-key";
import { useThreads } from "@/hooks/useThreads";
import { toast } from "sonner";
import { AssistantConfigProvider } from "./AssistantConfig";
import { normalizeApiUrl } from "./client";
import { TIMING } from "@/lib/constants";
import type { ServerAssistantData } from "@/lib/assistant-api-server";
import { saveActiveConnectionToCookies } from "@/lib/connection-cookies";

export type StateType = {
  messages?: Message[];
  ui?: UIMessage[];
  [key: string]: unknown; // Allow dynamic fields from input_schema
};

// 노드별 업데이트 정보 (스트리밍 이벤트에서 추출)
export interface NodeUpdateInfo {
  nodeName: string;       // 노드 이름 (이벤트에서 추출)
  namespace: string[];    // 서브그래프 경로
  timestamp: number;      // 업데이트 시간
  hasMessages: boolean;   // 메시지 업데이트 포함 여부
  streamingContent: string; // 현재까지의 스트리밍 콘텐츠
  isActive: boolean;      // 현재 활성(스트리밍 중) 여부
  completedOutput: string; // 노드 완료 시 저장된 출력
}

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
      context?: Record<string, unknown>;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

// 확장된 스트림 컨텍스트 타입 (노드 업데이트 정보 포함)
export type StreamContextType = ReturnType<typeof useTypedStream> & {
  nodeUpdates: NodeUpdateInfo[];
  clearNodeUpdates: () => void;
  updateNodeCompletedOutput: (nodeName: string, output: string) => void;
};
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = TIMING.THREAD_FETCH_DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  console.log("[checkGraphStatus] Checking connection to:", apiUrl);
  console.log("[checkGraphStatus] API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "none");

  if (!apiUrl || apiUrl.trim() === "") {
    console.error("[checkGraphStatus] ❌ API URL is empty");
    return false;
  }

  try {
    const url = `${apiUrl}/info`;
    console.log("[checkGraphStatus] Fetching:", url);

    const res = await fetch(url, {
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });

    console.log("[checkGraphStatus] Response status:", res.status, res.statusText);
    const isOk = res.ok;
    console.log(`[checkGraphStatus] ${isOk ? "✅" : "❌"} Connection ${isOk ? "successful" : "failed"}`);
    return isOk;
  } catch (e) {
    console.error("[checkGraphStatus] ❌ Error:", e);
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
  initialAssistantData,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
  initialAssistantData?: ServerAssistantData;
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();

  // 노드 업데이트 정보 추적
  const [nodeUpdates, setNodeUpdates] = useState<NodeUpdateInfo[]>([]);
  const nodeUpdatesRef = useRef<NodeUpdateInfo[]>([]);

  // Memoize callbacks to prevent infinite re-renders
  const handleCustomEvent = useCallback(
    (event: unknown, options: { mutate: (fn: (prev: StateType) => StateType) => void }) => {
      // Handle UI messages
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev: StateType) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
    []
  );

  // 스트리밍 이벤트에서 노드 정보 추출 (노드 이름만 추적, 콘텐츠는 messages에서)
  const handleUpdateEvent = useCallback(
    (
      data: { [node: string]: unknown },
      options: { namespace: string[] | undefined; mutate: (update: Partial<StateType> | ((prev: StateType) => Partial<StateType>)) => void }
    ) => {
      const nodeNames = Object.keys(data);
      const timestamp = Date.now();

      // DEBUG: SSE 이벤트 데이터 로깅
      console.log("[SSE Event]", {
        nodeNames,
        namespace: options.namespace,
        data: JSON.stringify(data, null, 2).slice(0, 500),
        currentNodeUpdates: nodeUpdatesRef.current.map(n => ({ name: n.nodeName, active: n.isActive, content: n.streamingContent?.slice(0, 50) }))
      });

      // 모든 기존 노드를 비활성화 (새 이벤트의 노드만 활성)
      for (const update of nodeUpdatesRef.current) {
        update.isActive = false;
      }

      for (const nodeName of nodeNames) {
        // 내부 노드(__start__, __end__) 제외
        if (nodeName.startsWith("__") && nodeName.endsWith("__")) continue;

        const nodeData = data[nodeName] as Record<string, unknown> | undefined;
        const hasMessages = nodeData && ("messages" in nodeData);

        // SSE 이벤트에서 직접 메시지 콘텐츠 추출
        let messageContent = "";
        if (hasMessages && nodeData) {
          const messages = nodeData.messages as unknown;
          if (Array.isArray(messages) && messages.length > 0) {
            // 마지막 메시지의 콘텐츠 추출
            const lastMsg = messages[messages.length - 1];
            if (typeof lastMsg === "object" && lastMsg !== null) {
              const content = (lastMsg as Record<string, unknown>).content;
              if (typeof content === "string") {
                messageContent = content;
              } else if (Array.isArray(content)) {
                // content가 배열인 경우 (예: [{type: "text", text: "..."}])
                messageContent = content
                  .map((c: unknown) => {
                    if (typeof c === "string") return c;
                    if (typeof c === "object" && c !== null && "text" in c) {
                      return (c as { text: string }).text;
                    }
                    return "";
                  })
                  .join("");
              }
            }
          } else if (typeof messages === "object" && messages !== null) {
            // 단일 메시지인 경우
            const content = (messages as Record<string, unknown>).content;
            if (typeof content === "string") {
              messageContent = content;
            }
          }
        }

        // 동일 노드의 기존 업데이트를 찾기
        const existingIndex = nodeUpdatesRef.current.findIndex(
          (u) => u.nodeName === nodeName && JSON.stringify(u.namespace) === JSON.stringify(options.namespace || [])
        );

        if (existingIndex >= 0) {
          // 기존 노드 업데이트 - 콘텐츠 누적
          const existingContent = nodeUpdatesRef.current[existingIndex].streamingContent;
          nodeUpdatesRef.current[existingIndex] = {
            ...nodeUpdatesRef.current[existingIndex],
            timestamp,
            hasMessages: nodeUpdatesRef.current[existingIndex].hasMessages || !!hasMessages,
            streamingContent: messageContent || existingContent, // 새 콘텐츠가 있으면 업데이트
            isActive: true,
          };
        } else {
          // 새 노드 추가
          nodeUpdatesRef.current.push({
            nodeName,
            namespace: options.namespace || [],
            timestamp,
            hasMessages: !!hasMessages,
            streamingContent: messageContent, // SSE에서 직접 추출한 콘텐츠
            isActive: true,
            completedOutput: "", // 완료 시 저장될 출력
          });
        }
      }

      // React 상태 업데이트
      setNodeUpdates([...nodeUpdatesRef.current]);
    },
    []
  );

  const handleThreadId = useCallback(
    (id: string) => {
      setThreadId(id);
      // 스레드 변경 시 노드 업데이트 초기화
      nodeUpdatesRef.current = [];
      setNodeUpdates([]);
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
    [setThreadId, getThreads, setThreads]
  );

  const streamValue = useTypedStream({
    apiUrl,
    apiKey: apiKey ?? undefined,
    assistantId,
    threadId: threadId ?? null,
    fetchStateHistory: true,
    onCustomEvent: handleCustomEvent,
    onUpdateEvent: handleUpdateEvent,
    onThreadId: handleThreadId,
  });

  // 스트리밍 완료 시 노드 업데이트 유지 (다음 Human 메시지까지)
  // 주의: nodeUpdates를 즉시 초기화하면 중간 노드 정보가 사라짐
  // 대신 스레드 변경 시 또는 새 Human 메시지 시작 시 초기화됨
  // (handleThreadIdChange에서 이미 처리됨)

  // 노드 업데이트 초기화 함수 (새 Human 메시지 전송 시 호출)
  const clearNodeUpdates = useCallback(() => {
    nodeUpdatesRef.current = [];
    setNodeUpdates([]);
  }, []);

  // 노드 완료 출력 업데이트 함수 (노드가 비활성화될 때 출력 저장)
  const updateNodeCompletedOutput = useCallback((nodeName: string, output: string) => {
    const nodeIndex = nodeUpdatesRef.current.findIndex(n => n.nodeName === nodeName);
    if (nodeIndex >= 0) {
      nodeUpdatesRef.current[nodeIndex] = {
        ...nodeUpdatesRef.current[nodeIndex],
        completedOutput: output,
      };
      setNodeUpdates([...nodeUpdatesRef.current]);
    }
  }, []);

  // 확장된 컨텍스트 값 생성
  const extendedStreamValue = useMemo(
    () => ({
      ...streamValue,
      nodeUpdates,
      clearNodeUpdates,
      updateNodeCompletedOutput,
    }),
    [streamValue, nodeUpdates, clearNodeUpdates, updateNodeCompletedOutput]
  );

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error("Failed to connect to LangGraph server", {
          description: () => (
            <p>
              Please ensure your graph is running at <code>{apiUrl}</code> and
              your API key is correctly set (if connecting to a deployed graph).
            </p>
          ),
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl]);

  return (
    <StreamContext.Provider value={extendedStreamValue}>
      <AssistantConfigProvider
        apiUrl={apiUrl}
        assistantId={assistantId}
        apiKey={apiKey}
        initialData={initialAssistantData}
      >
        {children}
      </AssistantConfigProvider>
    </StreamContext.Provider>
  );
};

export const StreamProvider: React.FC<{
  children: ReactNode;
  initialAssistantData?: ServerAssistantData;
}> = ({
  children,
  initialAssistantData,
}) => {
  // Get environment variables
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const envAssistantId: string | undefined = process.env.NEXT_PUBLIC_ASSISTANT_ID;
  const envApiKey: string | undefined = process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY;

  // Use URL params with env var fallbacks
  const [apiUrl, _setApiUrl] = useQueryState("apiUrl", {
    defaultValue: envApiUrl || "",
  });
  const [assistantId, _setAssistantId] = useQueryState("assistantId", {
    defaultValue: envAssistantId || "",
  });

  // For API key, use localStorage with env var fallback
  const [apiKey, _setApiKey] = useState(() => {
    const storedKey = getApiKey();
    // If no stored key but env var exists, use and save the env var
    if (!storedKey && envApiKey && typeof window !== "undefined") {
      window.localStorage.setItem("lg:chat:apiKey", envApiKey);
      return envApiKey;
    }
    return storedKey || envApiKey || "";
  });

  const _setApiKeyWrapper = (key: string) => {
    window.localStorage.setItem("lg:chat:apiKey", key);
    _setApiKey(key);
  };

  // Determine final values to use, prioritizing URL params then env vars
  const finalApiUrl = apiUrl || envApiUrl;
  const finalAssistantId = assistantId?.trim() || envAssistantId || "";
  const resolvedApiUrl = useMemo(
    () => normalizeApiUrl(finalApiUrl),
    [finalApiUrl]
  );

  // Log connection parameters
  console.log("[StreamProvider] Connection parameters:", {
    apiUrl,
    envApiUrl,
    finalApiUrl,
    resolvedApiUrl,
    assistantId,
    envAssistantId,
    finalAssistantId,
    apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "none",
  });

  // Sync connection to cookies for SSR (only on client, and only when values are set)
  const hasSyncedRef = useRef(false);
  useEffect(() => {
    // Only sync once on mount, and only if we have meaningful values
    if (hasSyncedRef.current) return;
    if (!resolvedApiUrl) return;

    hasSyncedRef.current = true;
    saveActiveConnectionToCookies({
      id: "current",
      apiUrl: resolvedApiUrl,
      assistantId: finalAssistantId || undefined,
      apiKey: apiKey || undefined,
    });
  }, [resolvedApiUrl, finalAssistantId, apiKey]);

  return (
    <StreamSession
      apiKey={apiKey}
      apiUrl={resolvedApiUrl}
      assistantId={finalAssistantId}
      initialAssistantData={initialAssistantData}
    >
      {children}
    </StreamSession>
  );
};

export default StreamContext;
