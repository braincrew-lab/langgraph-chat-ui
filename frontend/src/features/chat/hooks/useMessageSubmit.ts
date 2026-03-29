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
import { extractDisplayName } from "@/lib/utils/file-upload";
import { toast } from "sonner";
import type { StreamContextType } from "@/providers/Stream";
import type {
  FieldValue,
  FormState,
  SchemaFieldConfig,
} from "@/types/schema-ui";

interface UseMessageSubmitOptions {
  stream: StreamContextType;
  isAssistantSelected: boolean;
  input: string;
  setInput: (value: string) => void;
  contentBlocks: Base64ContentBlock[];
  setContentBlocks: (blocks: Base64ContentBlock[]) => void;
  getSubmitPayload: () => FormState;
  getDisplayPayload: () => FormState;
  resetForm: () => void;
  parsedSchema: {
    hasMessages: boolean;
    uiMode: string;
    requiredFields: SchemaFieldConfig[];
    optionalFields: SchemaFieldConfig[];
  };
}

const MAX_DISPLAY_STRING_LENGTH = 2000;
const MAX_DISPLAY_ARRAY_ITEM_LENGTH = 200;

function isFileField(field: SchemaFieldConfig): boolean {
  const nameContainsFile = field.name.toLowerCase().includes("file");
  const schema = field.resolvedSchema;
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const isStringType = fieldType === "string";
  const isStringArrayType =
    fieldType === "array" && schema.items?.type === "string";
  return nameContainsFile && (isStringType || isStringArrayType);
}

function sanitizeDisplayValue(
  value: FieldValue,
  field?: SchemaFieldConfig,
): FieldValue {
  if (value === null || value === undefined) {
    return value;
  }

  if (field && isFileField(field)) {
    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === "string" ? extractDisplayName(item) : String(item),
      );
    }
    if (typeof value === "string") {
      return extractDisplayName(value);
    }
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_DISPLAY_STRING_LENGTH
      ? `${value.slice(0, MAX_DISPLAY_STRING_LENGTH)}...`
      : value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item !== "string") return item;
      return item.length > MAX_DISPLAY_ARRAY_ITEM_LENGTH
        ? `${item.slice(0, MAX_DISPLAY_ARRAY_ITEM_LENGTH)}...`
        : item;
    });
  }

  return value;
}

function buildDisplaySubmission(
  payload: FormState,
  displayPayload: FormState,
  fields: SchemaFieldConfig[],
): FormState {
  const displayData: FormState = {};

  for (const field of fields) {
    const value = payload[field.name];
    if (value === undefined) continue;
    const displayValue = displayPayload[field.name];
    displayData[field.name] =
      displayValue !== undefined && isFileField(field)
        ? displayValue
        : sanitizeDisplayValue(value, field);
  }

  return displayData;
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
    getDisplayPayload,
    resetForm,
    parsedSchema,
  } = options;

  const [firstTokenReceived, setFirstTokenReceived] = useState(false);
  const [formSubmissions, setFormSubmissions] = useState<
    Array<{ data: FormState; fields: SchemaFieldConfig[]; timestamp: Date }>
  >([]);
  const lastFormSubmissionPayloadRef = useRef<FormState | null>(null);
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
      const displayPayload = getDisplayPayload();
      stream.clearNodeUpdates();

      // Capture values before clearing
      const currentInput = input;
      const currentBlocks = [...contentBlocks];

      // Store form submission if schema has file fields with values
      const allFields = [
        ...parsedSchema.requiredFields,
        ...parsedSchema.optionalFields,
      ];
      const hasFileData = allFields.some((f) => {
        if (!f.name.toLowerCase().includes("file")) return false;
        const val = schemaPayload[f.name];
        return Array.isArray(val) ? val.length > 0 : !!val;
      });
      if (hasFileData) {
        lastFormSubmissionPayloadRef.current = schemaPayload;
        setFormSubmissions((prev) => [
          ...prev.slice(-4),
          {
            data: buildDisplaySubmission(
              schemaPayload,
              displayPayload,
              allFields,
            ),
            fields: allFields,
            timestamp: new Date(),
          },
        ]);
      }

      // Clear form immediately
      setInput("");
      setContentBlocks([]);
      resetForm();

      if (parsedSchema.hasMessages) {
        const newHumanMessage: Message = {
          id: uuidv4(),
          type: "human",
          content: [
            ...(currentInput.trim().length > 0
              ? [{ type: "text", text: currentInput }]
              : []),
            ...currentBlocks,
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
      getDisplayPayload,
      resetForm,
      parsedSchema.hasMessages,
      parsedSchema.optionalFields,
      parsedSchema.requiredFields,
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
    } else if (lastFormSubmissionPayloadRef.current) {
      setFirstTokenReceived(false);
      stream.clearNodeUpdates();
      stream.submit(lastFormSubmissionPayloadRef.current, STREAM_OPTIONS);
    }
  }, [messages, stream]);

  const handleFormSubmit = useCallback(() => {
    if (!isAssistantSelected) {
      toast.error(t("selectGraph"));
      return;
    }

    const payload = getSubmitPayload();
    const displayPayload = getDisplayPayload();
    const allFields = [
      ...parsedSchema.requiredFields,
      ...parsedSchema.optionalFields,
    ];

    lastFormSubmissionPayloadRef.current = payload;
    setFormSubmissions((prev) => [
      ...prev.slice(-4),
      {
        data: buildDisplaySubmission(payload, displayPayload, allFields),
        fields: allFields,
        timestamp: new Date(),
      },
    ]);

    setFirstTokenReceived(false);
    resetForm();
    stream.submit(payload, STREAM_OPTIONS);
  }, [
    t,
    isAssistantSelected,
    getSubmitPayload,
    getDisplayPayload,
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
