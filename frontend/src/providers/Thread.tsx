"use client";

import { validate } from "uuid";
import { Thread, Client } from "@langchain/langgraph-sdk";
import {
  createContext,
  ReactNode,
  useCallback,
  useState,
  useMemo,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";
import { getApiKey } from "@/lib/api-key";
import type { ConnectionConfig } from "./Stream";

export interface ThreadContextType {
  getThreads: () => Promise<Thread[]>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
  client: Client | null;
}

export const ThreadContext = createContext<ThreadContextType | undefined>(
  undefined,
);

function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

interface ThreadProviderProps {
  children: ReactNode;
  connection: ConnectionConfig;
}

export function ThreadProvider({ children, connection }: ThreadProviderProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const finalAssistantId = connection.assistantId?.trim() || undefined;
  const apiKey = connection.apiKey || getApiKey() || undefined;

  // Create client once and memoize
  const client = useMemo(() => {
    if (!connection.apiUrl) return null;
    return createClient(connection.apiUrl, apiKey);
  }, [connection.apiUrl, apiKey]);

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    if (!client || !finalAssistantId) return [];

    const threads = await client.threads.search({
      metadata: {
        ...getThreadSearchMetadata(finalAssistantId),
      },
      limit: 100,
    });

    return threads;
  }, [client, finalAssistantId]);

  const value = useMemo(
    () => ({
      getThreads,
      threads,
      setThreads,
      threadsLoading,
      setThreadsLoading,
      client,
    }),
    [getThreads, threads, threadsLoading, client],
  );

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}
