import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from "react";
import {
  getAssistant,
  searchAssistants,
  getAssistantSchemas,
  updateAssistantConfig,
  isValidUUID,
  type AssistantConfig as AssistantConfigType,
  type AssistantSchemas,
  type Assistant,
} from "@/lib/assistant-api";
import type { ServerAssistantData } from "@/lib/assistant-api-server";

export interface AssistantConfigContextType {
  config: AssistantConfigType | null;
  schemas: AssistantSchemas | null;
  assistantId: string | null;
  isLoading: boolean;
  error: string | null;
  updateConfig: (newConfig: AssistantConfigType) => Promise<boolean>;
  refetchConfig: () => Promise<void>;
  assistants: Assistant[];
  assistantsLoading: boolean;
  refetchAssistants: () => Promise<void>;
}

export const AssistantConfigContext = createContext<
  AssistantConfigContextType | undefined
>(undefined);

export const AssistantConfigProvider: React.FC<{
  children: ReactNode;
  apiUrl: string;
  assistantId: string;
  apiKey: string | null;
  initialData?: ServerAssistantData;
}> = ({ children, apiUrl, assistantId: initialAssistantId, apiKey, initialData }) => {
  // Use initial data from SSR if available
  const [config, setConfig] = useState<AssistantConfigType | null>(
    () => initialData?.assistant?.config ?? null
  );
  const [schemas, setSchemas] = useState<AssistantSchemas | null>(
    () => initialData?.schemas ?? null
  );
  // Use resolved assistant ID from SSR if available
  const [assistantId, setAssistantId] = useState<string | null>(
    () => initialData?.assistantId ?? null
  );
  // Skip loading if we have initial data
  const [isLoading, setIsLoading] = useState(() => !initialData?.schemas);
  const [error, setError] = useState<string | null>(null);
  const [assistants, setAssistants] = useState<Assistant[]>(
    () => initialData?.assistants ?? []
  );
  const [assistantsLoading, setAssistantsLoading] = useState(false);

  const fetchAssistants = useCallback(async () => {
    if (!apiUrl) {
      return;
    }

    setAssistantsLoading(true);
    try {
      const list = await searchAssistants(
        apiUrl,
        {
          limit: 50,
          sort_order: "asc",
          sort_by: "assistant_id",
          select: ["assistant_id", "graph_id", "name"],
        },
        apiKey || undefined
      );
      setAssistants(list);
    } catch (error) {
      console.error("Failed to fetch assistants:", error);
      setAssistants([]);
    } finally {
      setAssistantsLoading(false);
    }
  }, [apiUrl, apiKey]);

  const fetchConfig = useCallback(async () => {
    console.log("[AssistantConfig] fetchConfig called with:", {
      apiUrl,
      initialAssistantId,
      apiKey: apiKey ? `${apiKey.substring(0, 10)}...` : "none",
    });

    setIsLoading(true);
    setError(null);

    // Early return if no assistant ID provided (this is valid - user can select from list)
    if (!initialAssistantId || initialAssistantId.trim() === "") {
      console.info("[AssistantConfig] No assistant ID provided - user can select from list");
      setIsLoading(false);
      setError(null);
      return;
    }

    try {
      let actualAssistantId = initialAssistantId;
      let assistant: Assistant | null = null;

      console.log("[AssistantConfig] Checking if UUID:", initialAssistantId);
      // If it's a valid UUID, try direct lookup first
      if (isValidUUID(initialAssistantId)) {
        console.log("[AssistantConfig] Valid UUID, trying direct lookup");

        assistant = await getAssistant(
          apiUrl,
          actualAssistantId,
          apiKey || undefined
        );
      }

      // If not found or not a UUID, search by graph_id
      if (!assistant) {
        console.log(
          `[AssistantConfig] Not a UUID or not found, searching by graph_id: "${initialAssistantId}"`
        );
        const assistants = await searchAssistants(
          apiUrl,
          {
            graph_id: initialAssistantId,
            limit: 1,
            sort_order: "asc",
            sort_by: "assistant_id",
            select: ["assistant_id"], // Only fetch assistant_id
          },
          apiKey || undefined
        );

        console.log(`[AssistantConfig] Search results:`, assistants);

        if (assistants.length > 0) {
          actualAssistantId = assistants[0].assistant_id;
          console.log(
            `[AssistantConfig] ✅ Resolved graph_id "${initialAssistantId}" to assistant ID: ${actualAssistantId}`
          );
          assistant = await getAssistant(
            apiUrl,
            actualAssistantId,
            apiKey || undefined
          );
          console.log(`[AssistantConfig] Assistant details:`, assistant);
        } else {
          const message = `No assistant found for graph_id: ${initialAssistantId}`;
          console.error(`[AssistantConfig] ❌ ${message}`);
          setError(message);
          setConfig(null);
          setSchemas(null);
          setAssistantId(null);
          setIsLoading(false);
          return;
        }
      }

      if (!assistant) {
        const message = `Failed to load assistant configuration for ID: ${actualAssistantId}`;
        console.error(message);
        setError(message);
        setConfig(null);
        setSchemas(null);
        setAssistantId(null);
        return;
      }

      setAssistantId(actualAssistantId);
      setConfig(assistant.config);

      const assistantSchemas = await getAssistantSchemas(
        apiUrl,
        actualAssistantId,
        apiKey || undefined
      );

      // Debug: Log state_schema to understand structure
      console.log("[AssistantConfig] 📋 Fetched schemas:", {
        graph_id: assistantSchemas?.graph_id,
        state_schema: assistantSchemas?.state_schema,
        input_schema: assistantSchemas?.input_schema,
      });

      setSchemas(assistantSchemas);
    } catch (err) {
      console.error("Error fetching assistant config:", err);
      setError("Unable to load assistant configuration");
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, initialAssistantId, apiKey]);

  // Skip initial fetch if we have SSR data
  useEffect(() => {
    // If we have initial schemas from SSR, skip the fetch
    if (initialData?.schemas && initialData?.assistantId) {
      console.log("[AssistantConfig] Using SSR data, skipping initial fetch");
      return;
    }
    fetchConfig();
  }, [fetchConfig, initialData?.schemas, initialData?.assistantId]);

  useEffect(() => {
    // If we have initial assistants from SSR, skip the fetch
    if (initialData?.assistants && initialData.assistants.length > 0) {
      console.log("[AssistantConfig] Using SSR assistants, skipping initial fetch");
      return;
    }
    fetchAssistants();
  }, [fetchAssistants, initialData?.assistants]);

  const updateConfig = useCallback(async (
    newConfig: AssistantConfigType
  ): Promise<boolean> => {
    if (!assistantId) {
      console.error("No assistant ID available for update");
      return false;
    }

    try {
      const assistant = await updateAssistantConfig(
        apiUrl,
        assistantId,
        newConfig,
        apiKey || undefined
      );
      if (assistant) {
        setConfig(assistant.config);
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update config:", err);
      return false;
    }
  }, [apiUrl, assistantId, apiKey]);

  const contextValue = useMemo(
    () => ({
      config,
      schemas,
      assistantId,
      isLoading,
      error,
      updateConfig,
      refetchConfig: fetchConfig,
      assistants,
      assistantsLoading,
      refetchAssistants: fetchAssistants,
    }),
    [
      config,
      schemas,
      assistantId,
      isLoading,
      error,
      updateConfig,
      fetchConfig,
      assistants,
      assistantsLoading,
      fetchAssistants,
    ]
  );

  return (
    <AssistantConfigContext.Provider value={contextValue}>
      {children}
    </AssistantConfigContext.Provider>
  );
};
