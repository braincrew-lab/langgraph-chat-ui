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
  getAssistantGraph,
  extractAllFinalNodeNames,
  isValidUUID,
  type AssistantConfig as AssistantConfigType,
  type AssistantSchemas,
  type Assistant,
  type GraphStructure,
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
  // 그래프 구조 정보
  graphStructure: GraphStructure | null;
  finalNodeNames: string[];  // __end__로 연결되는 노드들
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
  enableGraphSelection?: boolean;
  defaultGraphId?: string;
}> = ({ children, apiUrl, assistantId: initialAssistantId, apiKey, initialData, enableGraphSelection = true, defaultGraphId = "" }) => {
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
  const [graphStructure, setGraphStructure] = useState<GraphStructure | null>(null);
  const [finalNodeNames, setFinalNodeNames] = useState<string[]>([]);

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

      // If it's a valid UUID, try direct lookup first
      if (isValidUUID(initialAssistantId)) {

        assistant = await getAssistant(
          apiUrl,
          actualAssistantId,
          apiKey || undefined
        );
      }

      // If not found or not a UUID, search by graph_id
      if (!assistant) {
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

        if (assistants.length > 0) {
          actualAssistantId = assistants[0].assistant_id;
          assistant = await getAssistant(
            apiUrl,
            actualAssistantId,
            apiKey || undefined
          );
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

      setSchemas(assistantSchemas);

      // 그래프 구조 조회하여 마지막 노드 파악
      const graph = await getAssistantGraph(
        apiUrl,
        actualAssistantId,
        apiKey || undefined
      );

      if (graph) {
        setGraphStructure(graph);
        const finalNodes = extractAllFinalNodeNames(graph);
        setFinalNodeNames(finalNodes);
      }
    } catch (err) {
      console.error("Error fetching assistant config:", err);
      setError("Unable to load assistant configuration");
      setAssistantId(null);
      setConfig(null);
      setSchemas(null);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, initialAssistantId, apiKey]);

  // Sync state when initialData changes (e.g., after router.refresh() with new SSR data)
  useEffect(() => {
    if (initialData) {
      // Update state from new SSR data
      if (initialData.assistantId) {
        setAssistantId(initialData.assistantId);
      }
      if (initialData.assistant?.config) {
        setConfig(initialData.assistant.config);
      }
      if (initialData.schemas) {
        setSchemas(initialData.schemas);
        setIsLoading(false);
      }
      if (initialData.assistants) {
        setAssistants(initialData.assistants);
      }
    }
  }, [initialData]);

  // Sync state when initialAssistantId prop changes (e.g., after router.refresh())
  // This is needed because useState only uses initialData for initial render
  const prevInitialAssistantIdRef = React.useRef(initialAssistantId);
  useEffect(() => {
    const prevId = prevInitialAssistantIdRef.current;
    const newId = initialAssistantId?.trim() || "";

    // Only trigger if the prop actually changed (not on initial mount)
    if (prevId !== initialAssistantId) {
      prevInitialAssistantIdRef.current = initialAssistantId;

      if (newId) {
        // New assistant selected - refetch config
        fetchConfig();
      } else {
        // No assistant selected - clear state
        setAssistantId(null);
        setConfig(null);
        setSchemas(null);
        setGraphStructure(null);
        setFinalNodeNames([]);
        setIsLoading(false);
      }
    }
  }, [initialAssistantId, fetchConfig]);

  // Skip initial fetch if we have SSR data
  useEffect(() => {
    if (initialData?.schemas && initialData?.assistantId) {
      return;
    }
    fetchConfig();
  }, [fetchConfig, initialData?.schemas, initialData?.assistantId]);

  useEffect(() => {
    if (initialData?.assistants && initialData.assistants.length > 0) {
      return;
    }
    fetchAssistants();
  }, [fetchAssistants, initialData?.assistants]);

  // Auto-select assistant if no valid selection exists
  // Priority: 1. Default graph ID (when graph selection is disabled)
  //           2. First assistant in the list
  // This also triggers a page reload to sync the cookie with StreamProvider
  const autoSelectTriggeredRef = React.useRef(false);
  useEffect(() => {
    // Only auto-select if:
    // 1. No current assistantId (invalid or missing)
    // 2. Assistants list is loaded
    // 3. At least one assistant exists
    // 4. Not currently loading
    // 5. Haven't already triggered auto-select
    if (!assistantId && !isLoading && assistants.length > 0 && !autoSelectTriggeredRef.current) {
      autoSelectTriggeredRef.current = true;

      // Determine which assistant to select
      let targetAssistantId: string;

      // If graph selection is disabled and a default graph ID is configured, use it
      if (!enableGraphSelection && defaultGraphId) {
        // Try to find the assistant matching the default graph ID
        const defaultAssistant = assistants.find(
          a => a.assistant_id === defaultGraphId || a.graph_id === defaultGraphId
        );
        targetAssistantId = defaultAssistant?.assistant_id || assistants[0].assistant_id;
      } else {
        // Otherwise, use the first assistant
        targetAssistantId = assistants[0].assistant_id;
      }

      // Import dynamically to avoid server-side issues
      import("@/app/actions").then(({ updateAssistantIdAction }) => {
        updateAssistantIdAction(targetAssistantId).then(() => {
          // Reload to sync cookie with all providers
          window.location.reload();
        });
      });
    }
  }, [assistantId, isLoading, assistants, enableGraphSelection, defaultGraphId]);

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
      graphStructure,
      finalNodeNames,
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
      graphStructure,
      finalNodeNames,
    ]
  );

  return (
    <AssistantConfigContext.Provider value={contextValue}>
      {children}
    </AssistantConfigContext.Provider>
  );
};
