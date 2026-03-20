/**
 * Unified Input Area Component
 * Combines Form mode and Chat mode into a single component
 *
 * Structure:
 * ┌─────────────────────────────────────────┐
 * │  SchemaFieldsSection (optional)         │  ← 고급 입력 (스키마 필드 있을 때만)
 * ├─────────────────────────────────────────┤
 * │  InputSection (조건부 분기)             │
 * │  - Form: RequiredFields                 │
 * │  - Chat: textarea                       │
 * ├─────────────────────────────────────────┤
 * │  ActionBar (공통)                       │  ← 하단 100% width
 * │  - 좌측: 설정 (도구, 뷰, 그래프 선택)   │
 * │  - 우측: 파일 업로드 (Chat) + Submit    │
 * └─────────────────────────────────────────┘
 */

import React, {
  FormEvent,
  ChangeEvent,
  RefObject,
  useState,
  useEffect,
} from "react";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SchemaFieldsSection } from "./SchemaFieldsSection";
import { SchemaField, isFileField } from "./SchemaField";
import { ActionBar } from "./ActionBar";
import { ContentBlocksPreview } from "../content/ContentBlocksPreview";
import type { UseSchemaUIReturn } from "@/features/chat/hooks/useSchemaUI";
import type { Assistant } from "@/app/actions/assistant";
import type { Base64ContentBlock } from "@langchain/core/messages";
import type { SchemaFieldType } from "@/types/schema-ui";
import { getFieldType, getArrayItemSchema } from "@/lib/utils/schema";
import { UI } from "@/lib/constants";

interface UnifiedInputAreaProps {
  schemaUI: UseSchemaUIReturn;
  isFormMode: boolean;

  // Form mode
  onFormSubmit: () => void;

  // Chat mode
  input: string;
  onInputChange: (value: string) => void;
  onChatSubmit: (e: FormEvent) => void;
  contentBlocks: Base64ContentBlock[];
  onRemoveBlock: (idx: number) => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  dropRef: RefObject<HTMLDivElement | null>;
  dragOver: boolean;

  // Common
  isLoading: boolean;
  onStop: () => void;
  isAssistantSelected: boolean;
  enableFileUpload: boolean;
  placeholder?: string;
  className?: string;

  // Toolbar controls
  compactView: boolean;
  onCompactViewChange: (value: boolean) => void;

  // Assistant selector
  assistants: Assistant[];
  selectedAssistantId: string;
  assistantsLoading: boolean;
  onAssistantChange: (value: string) => void;
  onRefreshAssistants: () => void;

  // Chat page mode - enables form collapse even when not streaming
  isChatPage?: boolean;

  // Global settings controls
  enableGraphSelection?: boolean;
  enableAdvancedInput?: boolean;
  fileUploadMode?: "base64" | "url";
}

export function UnifiedInputArea({
  schemaUI,
  isFormMode,
  onFormSubmit,
  input,
  onInputChange,
  onChatSubmit,
  contentBlocks,
  onRemoveBlock,
  onFileUpload,
  onPaste,
  dropRef,
  dragOver,
  isLoading,
  onStop,
  isAssistantSelected,
  enableFileUpload,
  placeholder,
  className,
  compactView,
  onCompactViewChange,
  assistants,
  selectedAssistantId,
  assistantsLoading,
  onAssistantChange,
  onRefreshAssistants,
  isChatPage = false,
  enableGraphSelection = true,
  enableAdvancedInput = true,
  fileUploadMode = "base64",
}: UnifiedInputAreaProps) {
  const t = useTranslations("chat");
  const {
    isFormValid,
    parsedSchema,
    formState,
    setFieldValue,
    isLoading: schemaLoading,
  } = schemaUI;
  const { requiredFields, rawSchema } = parsedSchema;

  // Form collapse state - collapsed by default on chat page
  const [isFormCollapsed, setIsFormCollapsed] = useState(isChatPage);

  // Auto-collapse form when entering chat page or when streaming starts
  useEffect(() => {
    if (isChatPage && isFormMode) {
      setIsFormCollapsed(true);
    }
  }, [isChatPage, isFormMode]);

  // Collapse form when streaming starts
  useEffect(() => {
    if (isLoading && isFormMode) {
      setIsFormCollapsed(true);
    }
  }, [isLoading, isFormMode]);

  // Hidden while schema is loading (SSR should prevent this in most cases)
  if (schemaLoading) {
    return null;
  }

  // Show collapsible UI in form mode when: streaming OR on chat page
  const shouldShowCollapsibleForm = isFormMode && (isChatPage || isLoading);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isFormValid && !isLoading) {
      onFormSubmit();
    }
  };

  return (
    <div
      ref={isFormMode ? undefined : dropRef}
      className={cn(
        "bg-card dark:bg-secondary mb-4 rounded-3xl border shadow-md",
        !isFormMode && dragOver
          ? "border-primary border-2 border-dotted"
          : "border-border",
        className,
      )}
    >
      <form
        onSubmit={isFormMode ? handleFormSubmit : onChatSubmit}
        className="grid grid-rows-[1fr_auto]"
      >
        {/* 공통: SchemaFieldsSection - 상단, 고급 입력 (optional fields) */}
        {enableAdvancedInput ? (
          <SchemaFieldsSection
            schemaUI={schemaUI}
            disabled={isLoading}
            fileUploadMode={fileUploadMode}
          />
        ) : (
          /* 고급 입력 비활성화 시 상단 여백 */
          <div className="pt-4" />
        )}

        {/* 조건부 분기: InputSection */}
        {isFormMode ? (
          /* Form mode: RequiredFields + Submit 버튼 */
          shouldShowCollapsibleForm ? (
            /* Collapsible form (during streaming or on chat page) */
            <>
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setIsFormCollapsed(!isFormCollapsed)}
                  className="text-muted-foreground hover:text-foreground flex w-full items-center justify-between gap-2 text-sm transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        <span>{t("form.running")}</span>
                      </>
                    ) : (
                      <span>{t("form.showForm")}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{t("form.inputForm")}</span>
                    {isFormCollapsed ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {!isFormCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-border/50 mt-3 border-t pt-3">
                        {/* Required fields only (고급 입력 is already shown at top) */}
                        {requiredFields.length > 0 && rawSchema && (
                          <div className="max-h-[200px] space-y-3 overflow-y-auto">
                            {requiredFields.map((field) => (
                              <SchemaField
                                key={field.name}
                                field={field}
                                rootSchema={rawSchema}
                                value={formState[field.name]}
                                onChange={(value) =>
                                  setFieldValue(field.name, value)
                                }
                                disabled={true}
                                fileUploadMode={fileUploadMode}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* ActionBar with Stop button during streaming */}
              <ActionBar
                isFormMode={true}
                isLoading={isLoading}
                disabled={true}
                onStop={onStop}
                compactView={compactView}
                onCompactViewChange={onCompactViewChange}
                assistants={assistants}
                selectedAssistantId={selectedAssistantId}
                assistantsLoading={assistantsLoading}
                onAssistantChange={onAssistantChange}
                onRefreshAssistants={onRefreshAssistants}
                enableGraphSelection={enableGraphSelection}
              />
            </>
          ) : (
            /* Full form when not streaming */
            <>
              {requiredFields.length > 0 && rawSchema && (
                <div className="max-h-[300px] space-y-3 overflow-y-auto px-4 py-3">
                  {requiredFields.map((field) => (
                    <SchemaField
                      key={field.name}
                      field={field}
                      rootSchema={rawSchema}
                      value={formState[field.name]}
                      onChange={(value) => setFieldValue(field.name, value)}
                      disabled={isLoading}
                      fileUploadMode={fileUploadMode}
                    />
                  ))}
                </div>
              )}
              <ActionBar
                isFormMode={true}
                isLoading={isLoading}
                disabled={!isFormValid || isLoading}
                compactView={compactView}
                onCompactViewChange={onCompactViewChange}
                assistants={assistants}
                selectedAssistantId={selectedAssistantId}
                assistantsLoading={assistantsLoading}
                onAssistantChange={onAssistantChange}
                onRefreshAssistants={onRefreshAssistants}
                enableGraphSelection={enableGraphSelection}
              />
            </>
          )
        ) : (
          /* Chat mode: textarea + file upload + submit */
          (() => {
            // Find required file fields in chat mode schema
            const requiredFileFields = rawSchema
              ? requiredFields.filter((f) => {
                  const ft = getFieldType(
                    f.schema,
                    rawSchema,
                  ) as SchemaFieldType;
                  const itemSchema =
                    ft === "array"
                      ? getArrayItemSchema(f, rawSchema)
                      : null;
                  const it = itemSchema
                    ? (getFieldType(
                        itemSchema,
                        rawSchema,
                      ) as SchemaFieldType)
                    : undefined;
                  return isFileField(f.name, ft, it);
                })
              : [];

            // Check if all required file fields have values
            const fileFieldsValid = requiredFileFields.every((f) => {
              const v = formState[f.name];
              if (Array.isArray(v)) return v.length > 0;
              return !!v;
            });

            return (
              <>
                {/* Required file fields for chat mode schemas */}
                {requiredFileFields.length > 0 && rawSchema && (
                  <div className="min-w-0 space-y-3 overflow-hidden px-4 pt-3">
                    {requiredFileFields.map((field) => (
                      <SchemaField
                        key={field.name}
                        field={field}
                        rootSchema={rawSchema}
                        value={formState[field.name]}
                        onChange={(value) =>
                          setFieldValue(field.name, value)
                        }
                        disabled={isLoading}
                        fileUploadMode={fileUploadMode}
                      />
                    ))}
                  </div>
                )}

                <ContentBlocksPreview
                  blocks={contentBlocks}
                  onRemove={onRemoveBlock}
                />

                <textarea
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  onPaste={onPaste}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.metaKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      const el = e.target as HTMLElement | undefined;
                      const form = el?.closest("form");
                      form?.requestSubmit();
                    }
                  }}
                  placeholder={placeholder || t("placeholder")}
                  rows={1}
                  style={{ maxHeight: `${UI.CHAT_TEXTAREA_MAX_HEIGHT}px` }}
                  className="placeholder:text-muted-foreground [&::-webkit-scrollbar-thumb]:bg-border field-sizing-content resize-none overflow-y-auto border-none bg-transparent px-4 pt-4 pb-2 text-base leading-relaxed shadow-none ring-0 outline-none focus:ring-0 focus:outline-none [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent"
                />

                <ActionBar
                  isFormMode={false}
                  isLoading={isLoading}
                  disabled={
                    isLoading ||
                    (!input.trim() && contentBlocks.length === 0) ||
                    !isAssistantSelected ||
                    !fileFieldsValid
                  }
                  onStop={onStop}
                  enableFileUpload={enableFileUpload}
                  onFileUpload={onFileUpload}
                  compactView={compactView}
                  onCompactViewChange={onCompactViewChange}
                  assistants={assistants}
                  selectedAssistantId={selectedAssistantId}
                  assistantsLoading={assistantsLoading}
                  onAssistantChange={onAssistantChange}
                  onRefreshAssistants={onRefreshAssistants}
                  enableGraphSelection={enableGraphSelection}
                />
              </>
            );
          })()
        )}
      </form>
    </div>
  );
}
