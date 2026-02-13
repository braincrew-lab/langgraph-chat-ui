import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { useTranslations } from "next-intl";
import type { Checkpoint, Message } from "@langchain/langgraph-sdk";
import type { Base64ContentBlock } from "@langchain/core/messages";
import { STREAM_OPTIONS } from "@/lib/constants";
import { ensureToolCallsHaveResponses } from "@/lib/utils/ensure-tool-responses";
import { toast } from "sonner";
import type { StreamContextType } from "@/providers/Stream";
import type { FormState, SchemaFieldConfig } from "@/types/schema-ui";

interface UseMessageSubmitOptions {
  stream: StreamContextType;
  isAssistantSelected: boolean;
  input: string;
  setInput: (value: string) => void;
  contentBlocks: Base64ContentBlock[];
  setContentBlocks: (blocks: Base64ContentBlock[]) => void;
  getSubmitPayload: () => FormState;
  resetForm: () => void;
  parsedSchema: {
    hasMessages: boolean;
    uiMode: string;
    requiredFields: SchemaFieldConfig[];
    optionalFields: SchemaFieldConfig[];
  };
}

export function useMessageSubmit(options: UseMessageSubmitOptions) {
  const t = useTranslations("chat");
  const {
    stream,
    isAssistantSelected,
    input,
    setInput,
    contentBlocks,
    setContentBlocks,
    getSubmitPayload,
    resetForm,
    parsedSchema,
  } = options;

  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [formSubmissions, setFormSubmissions] = useState<
    Array<{ data: FormState; fields: SchemaFieldConfig[]; timestamp: Date }>
  >([]);
  const prevMessageLength = useRef(0);
  const messages = stream.messages;
  const isLoading = stream.isLoading;

  // Detect first AI token received
  useEffect(() => {
    if (
      messages.length !== prevMessageLength.current &&
      messages?.length &&
      messages[messages.length - 1].type === "ai"
    ) {
      setFirstTokenReceived(true);
    }
    prevMessageLength.current = messages.length;
  }, [messages]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!isAssistantSelected) {
        toast.error(t("selectGraph"));
        return;
      }
      if (
        (input.trim().length === 0 && contentBlocks.length === 0) ||
        isLoading
      ) {
        return;
      }
      setFirstTokenReceived(false);

      const schemaPayload = getSubmitPayload();
      stream.clearNodeUpdates();

      if (parsedSchema.hasMessages) {
        const newHumanMessage: Message = {
          id: uuidv4(),
          type: "human",
          content: [
            ...(input.trim().length > 0 ? [{ type: "text", text: input }] : []),
            ...contentBlocks,
          ] as Message["content"],
        };

        const toolMessages = ensureToolCallsHaveResponses(stream.messages);

        stream.submit(
          { messages: [...toolMessages, newHumanMessage], ...schemaPayload },
          {
            ...STREAM_OPTIONS,
            optimisticValues: (prev) => ({
              ...prev,
              messages: [
                ...(prev.messages ?? []),
                ...toolMessages,
                newHumanMessage,
              ],
            }),
          },
        );
      } else {
        stream.submit(schemaPayload, STREAM_OPTIONS);
      }

      setInput("");
      setContentBlocks([]);
    },
    [
      t,
      isAssistantSelected,
      input,
      contentBlocks,
      isLoading,
      stream,
      setInput,
      setContentBlocks,
      getSubmitPayload,
      parsedSchema.hasMessages,
    ],
  );

  const handleRegenerate = useCallback(
    (parentCheckpoint: Checkpoint | null | undefined) => {
      prevMessageLength.current = prevMessageLength.current - 1;
      setFirstTokenReceived(false);
      stream.clearNodeUpdates();
      stream.submit(undefined, {
        checkpoint: parentCheckpoint,
        ...STREAM_OPTIONS,
      });
    },
    [stream],
  );

  const handleRetry = useCallback(() => {
    const lastHumanMessage = [...messages]
      .reverse()
      .find((m) => m.type === "human");

    if (lastHumanMessage) {
      setFirstTokenReceived(false);
      stream.clearNodeUpdates();

      const lastHumanIndex = messages.findIndex(
        (m) => m.id === lastHumanMessage.id,
      );
      const toolMessages = ensureToolCallsHaveResponses(
        messages.slice(0, lastHumanIndex),
      );

      stream.submit(
        { messages: [...toolMessages, lastHumanMessage] },
        STREAM_OPTIONS,
      );
    } else if (formSubmissions.length > 0) {
      const lastSubmission = formSubmissions[formSubmissions.length - 1];
      setFirstTokenReceived(false);
      stream.clearNodeUpdates();
      stream.submit(lastSubmission.data, STREAM_OPTIONS);
    }
  }, [messages, stream, formSubmissions]);

  const handleFormSubmit = useCallback(() => {
    if (!isAssistantSelected) {
      toast.error(t("selectGraph"));
      return;
    }

    const payload = getSubmitPayload();
    const allFields = [
      ...parsedSchema.requiredFields,
      ...parsedSchema.optionalFields,
    ];

    setFormSubmissions((prev) => [
      ...prev,
      { data: payload, fields: allFields, timestamp: new Date() },
    ]);

    setFirstTokenReceived(false);
    stream.submit(payload, STREAM_OPTIONS);
    resetForm();
  }, [
    t,
    isAssistantSelected,
    getSubmitPayload,
    parsedSchema,
    stream,
    resetForm,
  ]);

  return {
    handleSubmit,
    handleRegenerate,
    handleRetry,
    handleFormSubmit,
    firstTokenReceived,
    setFirstTokenReceived,
    formSubmissions,
    prevMessageLength,
  };
}
