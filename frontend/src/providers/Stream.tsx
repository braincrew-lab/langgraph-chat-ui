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
import { useTranslations } from "next-intl";
import { useThreads } from "@/shared/hooks/useThreads";
import { toast } from "sonner";
import { AssistantConfigProvider } from "./AssistantConfig";
import { normalizeApiUrl } from "./client";
import { TIMING } from "@/lib/constants";
import type { ServerAssistantData } from "./AssistantConfig";

// Connection configuration from server
export interface ConnectionConfig {
  apiUrl: string;
  assistantId: string;
  apiKey: string;
}

export type StateType = {
  messages?: Message[];
  ui?: UIMessage[];
  [key: string]: unknown; // Allow dynamic fields from input_schema
};

// 노드별 업데이트 정보 (스트리밍 이벤트에서 추출)
export interface NodeUpdateInfo {
  nodeName: string; // 노드 이름 (이벤트에서 추출)
  namespace: string[]; // 서브그래프 경로
  timestamp: number; // 업데이트 시간
  hasMessages: boolean; // 메시지 업데이트 포함 여부
  streamingContent: string; // 현재까지의 스트리밍 콘텐츠
  isActive: boolean; // 현재 활성(스트리밍 중) 여부
  completedOutput: string; // 노드 완료 시 저장된 출력
  /** 서브그래프 model 노드에서 추출한 tool_calls */
  toolCalls?: Array<{
    id?: string;
    name: string;
    args?: Record<string, unknown>;
  }>;
  /** 서브그래프 tools 노드에서 추출한 tool 결과 */
  toolResults?: Array<{
    name: string;
    toolCallId?: string;
  }>;
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
// ReturnType<typeof useTypedStream>이 SDK의 제네릭 반환 타입을 올바르게 해석하지 못하므로
// 누락되는 SDK 속성을 명시적으로 추가합니다.
export type StreamContextType = ReturnType<typeof useTypedStream> & {
  nodeUpdates: NodeUpdateInfo[];
  clearNodeUpdates: () => void;
  deactivateAllNodes: () => void;
  updateNodeCompletedOutput: (nodeName: string, output: string) => void;
  /** Map of message ID → node name (for intermediate node tracking) */
  messageNodeMap: Map<string, string>;
  /** The resolved LangGraph API URL */
  apiUrl: string;
  // SDK properties not captured by ReturnType<typeof useTypedStream>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMessagesMetadata: (message: Message, index?: number) => any;
  setBranch: (branch: string) => void;
};
const StreamContext = createContext<StreamContextType | undefined>(undefined);

async function sleep(ms = TIMING.THREAD_FETCH_DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkGraphStatus(
  apiUrl: string,
  apiKey: string | null,
): Promise<boolean> {
  if (!apiUrl || apiUrl.trim() === "") {
    return false;
  }

  try {
    const url = `${apiUrl}/info`;
    const res = await fetch(url, {
      ...(apiKey && {
        headers: {
          "X-Api-Key": apiKey,
        },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const StreamSession = ({
  children,
  apiKey,
  apiUrl,
  assistantId,
  initialAssistantData,
  enableGraphSelection,
  defaultGraphId,
}: {
  children: ReactNode;
  apiKey: string | null;
  apiUrl: string;
  assistantId: string;
  initialAssistantData?: ServerAssistantData;
  enableGraphSelection?: boolean;
  defaultGraphId?: string;
}) => {
  const t = useTranslations("chat");
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();

  // 노드 업데이트 정보 추적
  const [nodeUpdates, setNodeUpdates] = useState<NodeUpdateInfo[]>([]);
  const nodeUpdatesRef = useRef<NodeUpdateInfo[]>([]);

  // 메시지 ID → 노드 이름 매핑 (중간 노드 추적용)
  const messageNodeMapRef = useRef(new Map<string, string>());
  const [messageNodeMap, setMessageNodeMap] = useState(
    new Map<string, string>(),
  );
  const prevAiMessageCountRef = useRef(0);
  const currentActiveNodeRef = useRef<string | null>(null);

  // Memoize callbacks to prevent infinite re-renders
  const handleCustomEvent = useCallback(
    (
      event: unknown,
      options: { mutate: (fn: (prev: StateType) => StateType) => void },
    ) => {
      // Handle UI messages
      if (isUIMessage(event) || isRemoveUIMessage(event)) {
        options.mutate((prev: StateType) => {
          const ui = uiMessageReducer(prev.ui ?? [], event);
          return { ...prev, ui };
        });
      }
    },
    [],
  );

  // 스트리밍 이벤트에서 노드 정보 추출 (노드 이름만 추적, 콘텐츠는 messages에서)
  const handleUpdateEvent = useCallback(
    (
      data: { [node: string]: unknown },
      options: {
        namespace: string[] | undefined;
        mutate: (
          update:
            | Partial<StateType>
            | ((prev: StateType) => Partial<StateType>),
        ) => void;
      },
    ) => {
      const nodeNames = Object.keys(data);
      const timestamp = Date.now();
      const incomingNs = JSON.stringify(options.namespace || []);

      // 같은 namespace 내 기존 노드만 비활성화 (다른 서브그래프는 건드리지 않음)
      nodeUpdatesRef.current = nodeUpdatesRef.current.map((u) => {
        if (JSON.stringify(u.namespace) === incomingNs) {
          return { ...u, isActive: false };
        }
        return u;
      });

      for (const nodeName of nodeNames) {
        // 내부 노드(__start__, __end__) 및 미들웨어 노드 제외
        if (nodeName.startsWith("__") && nodeName.endsWith("__")) continue;
        if (nodeName.toLowerCase().includes("middleware")) continue;

        const nodeData = data[nodeName] as Record<string, unknown> | undefined;
        const hasMessages = nodeData && "messages" in nodeData;

        // SSE 이벤트에서 콘텐츠 추출 (다양한 소스 시도)
        let messageContent = "";

        if (nodeData) {
          // 1. messages 필드에서 추출
          if (hasMessages) {
            const rawMessages = nodeData.messages as unknown;
            const messages = Array.isArray(rawMessages)
              ? rawMessages
              : typeof rawMessages === "object" && rawMessages !== null
                ? [rawMessages]
                : [];

            if (messages.length > 0) {
              const lastMsg = messages[messages.length - 1];
              if (typeof lastMsg === "object" && lastMsg !== null) {
                const content = (lastMsg as Record<string, unknown>).content;
                if (typeof content === "string") {
                  messageContent = content;
                } else if (Array.isArray(content)) {
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
            }
          }

          // 2. messages가 없으면 다른 필드에서 텍스트 추출 시도
          if (!messageContent) {
            // 우선순위가 높은 필드 먼저 확인
            const priorityFields = [
              "content",
              "text",
              "output",
              "response",
              "result",
              "data",
            ];
            for (const field of priorityFields) {
              const value = nodeData[field];
              if (typeof value === "string" && value.length > 0) {
                messageContent = value;
                break;
              }
            }
          }

          // 3. 여전히 없으면 모든 string 필드 검색
          if (!messageContent) {
            for (const [key, value] of Object.entries(nodeData)) {
              if (key === "messages") continue; // already handled
              if (typeof value === "string" && value.length > 10) {
                messageContent = value;
                break;
              }
            }
          }
        }

        // 서브그래프 내부 이벤트에서 tool 정보 추출
        let toolCalls:
          | Array<{
              id?: string;
              name: string;
              args?: Record<string, unknown>;
            }>
          | undefined;
        let toolResults:
          | Array<{ name: string; toolCallId?: string }>
          | undefined;

        if (nodeData) {
          const rawMessages = nodeData.messages as unknown;
          // Handle both formats: direct array or {value: [...]}
          const msgs = Array.isArray(rawMessages)
            ? rawMessages
            : rawMessages && typeof rawMessages === "object"
              ? Array.isArray(
                  (rawMessages as Record<string, unknown>).value,
                )
                ? ((rawMessages as Record<string, unknown>).value as unknown[])
                : [rawMessages]
              : [];

          for (const msg of msgs) {
            if (!msg || typeof msg !== "object") continue;
            const m = msg as Record<string, unknown>;

            // model 노드: tool_calls 추출 (모든 AI 메시지에서 누적)
            if (
              m.type === "ai" &&
              Array.isArray(m.tool_calls) &&
              (m.tool_calls as unknown[]).length > 0
            ) {
              if (!toolCalls) toolCalls = [];
              for (const tc of m.tool_calls as Array<{
                id?: string;
                name: string;
                args?: Record<string, unknown>;
              }>) {
                if (!toolCalls.some((e) => e.id && e.id === tc.id)) {
                  toolCalls.push({
                    id: tc.id,
                    name: tc.name,
                    args: tc.args,
                  });
                }
              }
            }

            // tools 노드: tool 결과 추출
            if (m.type === "tool" && typeof m.name === "string") {
              if (!toolResults) toolResults = [];
              toolResults.push({
                name: m.name as string,
                toolCallId: (m.tool_call_id as string) || undefined,
              });
            }
          }
        }

        // 동일 노드의 기존 업데이트를 찾기
        const existingIndex = nodeUpdatesRef.current.findIndex(
          (u) =>
            u.nodeName === nodeName &&
            JSON.stringify(u.namespace) === incomingNs,
        );

        if (existingIndex >= 0) {
          // 기존 노드 업데이트 - 콘텐츠 누적, tool 정보 병합
          const existing = nodeUpdatesRef.current[existingIndex];
          const mergedToolCalls = toolCalls
            ? [
                ...(existing.toolCalls || []),
                ...toolCalls.filter(
                  (tc) =>
                    !existing.toolCalls?.some((e) => e.id && e.id === tc.id),
                ),
              ]
            : existing.toolCalls;
          const mergedToolResults = toolResults
            ? [
                ...(existing.toolResults || []),
                ...toolResults.filter(
                  (tr) =>
                    !existing.toolResults?.some(
                      (e) =>
                        e.toolCallId && e.toolCallId === tr.toolCallId,
                    ),
                ),
              ]
            : existing.toolResults;

          nodeUpdatesRef.current[existingIndex] = {
            ...existing,
            timestamp,
            hasMessages: existing.hasMessages || !!hasMessages,
            // LangGraph SDK's onUpdateEvent delivers the full accumulated state per node,
            // so replacement (not concatenation) is the correct behavior here.
            streamingContent: messageContent || existing.streamingContent,
            isActive: true,
            toolCalls: mergedToolCalls,
            toolResults: mergedToolResults,
          };
        } else {
          // 새 노드 추가
          nodeUpdatesRef.current.push({
            nodeName,
            namespace: options.namespace || [],
            timestamp,
            hasMessages: !!hasMessages,
            streamingContent: messageContent,
            isActive: true,
            completedOutput: "",
            toolCalls,
            toolResults,
          });
        }
      }

      // 현재 활성 노드 저장 (메시지-노드 매핑용)
      const activeNode = nodeUpdatesRef.current.find((n) => n.isActive);
      if (activeNode) {
        currentActiveNodeRef.current = activeNode.nodeName;
      }

      // React 상태 업데이트
      setNodeUpdates([...nodeUpdatesRef.current]);
    },
    [],
  );

  const handleThreadId = useCallback(
    (id: string) => {
      setThreadId(id);
      // 스레드 변경 시 노드 업데이트 및 매핑 초기화
      nodeUpdatesRef.current = [];
      setNodeUpdates([]);
      messageNodeMapRef.current.clear();
      setMessageNodeMap(new Map());
      prevAiMessageCountRef.current = 0;
      currentActiveNodeRef.current = null;
      // Refetch threads list when thread ID changes.
      // Wait for some seconds before fetching so we're able to get the new thread that was created.
      sleep().then(() => getThreads().then(setThreads).catch(console.error));
    },
    [setThreadId, getThreads, setThreads],
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

  // 메시지-노드 매핑 업데이트 (새 AI 메시지가 추가될 때)
  // Uses message ID as key for stability across message reordering/deletion
  useEffect(() => {
    const messages = streamValue.messages || [];

    let aiIndex = 0;
    let hasNewMappings = false;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.type === "ai") {
        const msgId = msg.id;
        // 새로운 AI 메시지인 경우 현재 활성 노드에 매핑
        if (
          aiIndex >= prevAiMessageCountRef.current &&
          msgId &&
          !messageNodeMapRef.current.has(msgId)
        ) {
          const nodeName =
            currentActiveNodeRef.current ||
            (nodeUpdatesRef.current.length > 0
              ? nodeUpdatesRef.current[nodeUpdatesRef.current.length - 1]
                  .nodeName
              : null);
          if (nodeName) {
            messageNodeMapRef.current.set(msgId, nodeName);
            hasNewMappings = true;
          }
        }
        aiIndex++;
      }
    }

    // 새 AI 메시지가 추가된 경우 상태 업데이트
    if (hasNewMappings) {
      setMessageNodeMap(new Map(messageNodeMapRef.current));
    }
    prevAiMessageCountRef.current = aiIndex;
  }, [streamValue.messages, streamValue.isLoading]);

  // 2-3: Auto-deactivate all nodes when streaming stops
  useEffect(() => {
    if (
      !streamValue.isLoading &&
      nodeUpdatesRef.current.some((n) => n.isActive)
    ) {
      nodeUpdatesRef.current = nodeUpdatesRef.current.map((u) => ({
        ...u,
        isActive: false,
      }));
      setNodeUpdates([...nodeUpdatesRef.current]);
    }
  }, [streamValue.isLoading]);

  // 스트리밍 완료 시 노드 업데이트 유지 (다음 Human 메시지까지)
  // 주의: nodeUpdates를 즉시 초기화하면 중간 노드 정보가 사라짐
  // 대신 스레드 변경 시 또는 새 Human 메시지 시작 시 초기화됨
  // (handleThreadIdChange에서 이미 처리됨)

  // 노드 업데이트 초기화 함수 (새 Human 메시지 전송 시 호출)
  const clearNodeUpdates = useCallback(() => {
    nodeUpdatesRef.current = [];
    setNodeUpdates([]);
    messageNodeMapRef.current.clear();
    setMessageNodeMap(new Map());
    prevAiMessageCountRef.current = 0;
    currentActiveNodeRef.current = null;
  }, []);

  // Deactivate all node streaming indicators (used when stopping stream)
  const deactivateAllNodes = useCallback(() => {
    nodeUpdatesRef.current = nodeUpdatesRef.current.map((u) => ({
      ...u,
      isActive: false,
    }));
    setNodeUpdates([...nodeUpdatesRef.current]);
  }, []);

  // 노드 완료 출력 업데이트 함수 (노드가 비활성화될 때 출력 저장)
  const updateNodeCompletedOutput = useCallback(
    (nodeName: string, output: string) => {
      const nodeIndex = nodeUpdatesRef.current.findIndex(
        (n) => n.nodeName === nodeName,
      );
      if (nodeIndex >= 0) {
        nodeUpdatesRef.current[nodeIndex] = {
          ...nodeUpdatesRef.current[nodeIndex],
          completedOutput: output,
        };
        setNodeUpdates([...nodeUpdatesRef.current]);
      }
    },
    [],
  );

  // 확장된 컨텍스트 값 생성
  const extendedStreamValue = useMemo(
    () => ({
      ...streamValue,
      nodeUpdates,
      clearNodeUpdates,
      deactivateAllNodes,
      updateNodeCompletedOutput,
      messageNodeMap,
      apiUrl,
    }),
    [
      streamValue,
      nodeUpdates,
      clearNodeUpdates,
      deactivateAllNodes,
      updateNodeCompletedOutput,
      messageNodeMap,
      apiUrl,
    ],
  );

  useEffect(() => {
    checkGraphStatus(apiUrl, apiKey).then((ok) => {
      if (!ok) {
        toast.error(t("serverError"), {
          description: () => <p>{t("serverErrorDescription", { apiUrl })}</p>,
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, [apiKey, apiUrl, t]);

  return (
    <StreamContext.Provider value={extendedStreamValue}>
      <AssistantConfigProvider
        apiUrl={apiUrl}
        assistantId={assistantId}
        apiKey={apiKey}
        initialData={initialAssistantData}
        enableGraphSelection={enableGraphSelection}
        defaultGraphId={defaultGraphId}
      >
        {children}
      </AssistantConfigProvider>
    </StreamContext.Provider>
  );
};

export const StreamProvider: React.FC<{
  children: ReactNode;
  initialAssistantData?: ServerAssistantData;
  connection: ConnectionConfig;
  enableGraphSelection?: boolean;
  defaultGraphId?: string;
}> = ({
  children,
  initialAssistantData,
  connection,
  enableGraphSelection = true,
  defaultGraphId = "",
}) => {
  // Connection values come from server (already resolved: Cookies > Env vars)
  const resolvedApiUrl = useMemo(
    () => normalizeApiUrl(connection.apiUrl),
    [connection.apiUrl],
  );

  const finalAssistantId = connection.assistantId?.trim() || "";

  return (
    <StreamSession
      apiKey={connection.apiKey}
      apiUrl={resolvedApiUrl}
      assistantId={finalAssistantId}
      initialAssistantData={initialAssistantData}
      enableGraphSelection={enableGraphSelection}
      defaultGraphId={defaultGraphId}
    >
      {children}
    </StreamSession>
  );
};

export default StreamContext;
