import React, {
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
  useTransition,
} from "react";
import {
  getAssistantDataAction,
  updateAssistantConfigAction,
  searchAssistantsAction,
  refetchAssistantDataAction,
  type Assistant,
  type AssistantConfig as AssistantConfigType,
  type AssistantSchemas,
  type GraphStructure,
} from "@/app/actions/assistant";

// Re-export types for consumers
export type { Assistant, AssistantConfigType as AssistantConfig, AssistantSchemas, GraphStructure };

// Legacy type for backward compatibility with SSR data
export interface ServerAssistantData {
  assistantId: string | null;
  assistant: Assistant | null;
  schemas: AssistantSchemas | null;
  assistants: Assistant[];
}

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
  graphStructure: GraphStructure | null;
  finalNodeNames: string[];
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
}> = ({
  children,
  assistantId: initialAssistantId,
  initialData,
  enableGraphSelection = true,
  defaultGraphId = "",
}) => {
  // Use Server Action transition for non-blocking updates
  const [isPending, startTransition] = useTransition();

  // Initialize state from SSR data
  const [config, setConfig] = useState<AssistantConfigType | null>(
    () => initialData?.assistant?.config ?? null
  );
  const [schemas, setSchemas] = useState<AssistantSchemas | null>(
    () => initialData?.schemas ?? null
  );
  const [assistantId, setAssistantId] = useState<string | null>(
    () => initialData?.assistantId ?? null
  );
  const [assistants, setAssistants] = useState<Assistant[]>(
    () => initialData?.assistants ?? []
  );
  const [error, setError] = useState<string | null>(null);

  // Graph data (not in SSR, fetched on mount if assistant exists)
  const [graphStructure, setGraphStructure] = useState<GraphStructure | null>(null);
  const [finalNodeNames, setFinalNodeNames] = useState<string[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(() => !initialData?.schemas);
  const [assistantsLoading, setAssistantsLoading] = useState(false);

  // Fetch graph data on mount if we have an assistant ID from SSR
  useEffect(() => {
    if (initialData?.assistantId && !graphStructure) {
      startTransition(async () => {
        const result = await refetchAssistantDataAction(initialData.assistantId!);
        if (result.graphStructure) {
          setGraphStructure(result.graphStructure);
          setFinalNodeNames(result.finalNodeNames);
        }
      });
    }
  }, [initialData?.assistantId, graphStructure]);

  // Sync state when initialData changes (e.g., after router.refresh())
  useEffect(() => {
    if (initialData) {
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

  // Handle assistant ID changes (when user selects different assistant)
  const prevInitialAssistantIdRef = React.useRef(initialAssistantId);
  useEffect(() => {
    const prevId = prevInitialAssistantIdRef.current;

    if (prevId !== initialAssistantId) {
      prevInitialAssistantIdRef.current = initialAssistantId;

      if (initialAssistantId?.trim()) {
        // New assistant selected - fetch full data
        setIsLoading(true);
        startTransition(async () => {
          const result = await getAssistantDataAction(initialAssistantId);
          setAssistantId(result.assistantId);
          setConfig(result.assistant?.config ?? null);
          setSchemas(result.schemas);
          setGraphStructure(result.graphStructure);
          setFinalNodeNames(result.finalNodeNames);
          setAssistants(result.assistants);
          setError(result.error);
          setIsLoading(false);
        });
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
  }, [initialAssistantId]);

  // Fetch initial data if not provided from SSR
  useEffect(() => {
    if (!initialData?.schemas && initialAssistantId?.trim()) {
      setIsLoading(true);
      startTransition(async () => {
        const result = await getAssistantDataAction(initialAssistantId);
        setAssistantId(result.assistantId);
        setConfig(result.assistant?.config ?? null);
        setSchemas(result.schemas);
        setGraphStructure(result.graphStructure);
        setFinalNodeNames(result.finalNodeNames);
        setAssistants(result.assistants);
        setError(result.error);
        setIsLoading(false);
      });
    }
  }, [initialData?.schemas, initialAssistantId]);

  // Fetch assistants list if not provided from SSR
  useEffect(() => {
    if (!initialData?.assistants || initialData.assistants.length === 0) {
      setAssistantsLoading(true);
      startTransition(async () => {
        const result = await searchAssistantsAction();
        setAssistants(result.assistants);
        setAssistantsLoading(false);
      });
    }
  }, [initialData?.assistants]);

  // Auto-select assistant if no valid selection exists
  const autoSelectTriggeredRef = React.useRef(false);
  useEffect(() => {
    if (!assistantId && !isLoading && assistants.length > 0 && !autoSelectTriggeredRef.current) {
      autoSelectTriggeredRef.current = true;

      let targetAssistantId: string;

      if (!enableGraphSelection && defaultGraphId) {
        const defaultAssistant = assistants.find(
          a => a.assistant_id === defaultGraphId || a.graph_id === defaultGraphId
        );
        targetAssistantId = defaultAssistant?.assistant_id || assistants[0].assistant_id;
      } else {
        targetAssistantId = assistants[0].assistant_id;
      }

      // Import dynamically to avoid server-side issues
      import("@/app/actions").then(({ updateAssistantIdAction }) => {
        updateAssistantIdAction(targetAssistantId).then(() => {
          window.location.reload();
        });
      });
    }
  }, [assistantId, isLoading, assistants, enableGraphSelection, defaultGraphId]);

  // Update config using Server Action
  const updateConfig = useCallback(async (newConfig: AssistantConfigType): Promise<boolean> => {
    if (!assistantId) {
      console.error("No assistant ID available for update");
      return false;
    }

    const result = await updateAssistantConfigAction(assistantId, newConfig);
    if (result.success && result.assistant) {
      setConfig(result.assistant.config);
      return true;
    }

    setError(result.error);
    return false;
  }, [assistantId]);

  // Refetch config using Server Action
  const refetchConfig = useCallback(async () => {
    if (!assistantId) return;

    setIsLoading(true);
    const result = await refetchAssistantDataAction(assistantId);
    setConfig(result.assistant?.config ?? null);
    setSchemas(result.schemas);
    setGraphStructure(result.graphStructure);
    setFinalNodeNames(result.finalNodeNames);
    setError(result.error);
    setIsLoading(false);
  }, [assistantId]);

  // Refetch assistants list using Server Action
  const refetchAssistants = useCallback(async () => {
    setAssistantsLoading(true);
    const result = await searchAssistantsAction();
    setAssistants(result.assistants);
    setAssistantsLoading(false);
  }, []);

  const contextValue = useMemo(
    () => ({
      config,
      schemas,
      assistantId,
      isLoading: isLoading || isPending,
      error,
      updateConfig,
      refetchConfig,
      assistants,
      assistantsLoading: assistantsLoading || isPending,
      refetchAssistants,
      graphStructure,
      finalNodeNames,
    }),
    [
      config,
      schemas,
      assistantId,
      isLoading,
      isPending,
      error,
      updateConfig,
      refetchConfig,
      assistants,
      assistantsLoading,
      refetchAssistants,
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
