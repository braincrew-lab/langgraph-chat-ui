/**
 * Schema Fields Section Component
 * Renders expandable section for optional schema fields only
 * Settings controls have been moved to ActionBar
 */

import React from "react";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SchemaField } from "./SchemaField";
import type { UseSchemaUIReturn } from "@/features/chat/hooks/useSchemaUI";
import type { SchemaFieldConfig } from "@/types/schema-ui";

interface SchemaFieldsSectionProps {
  schemaUI: UseSchemaUIReturn;
  /** Override which fields to display. When provided, used instead of optionalFields from schemaUI. */
  fields?: SchemaFieldConfig[];
  disabled?: boolean;
  className?: string;
  fileUploadMode?: "base64" | "url";
}

export function SchemaFieldsSection({
  schemaUI,
  fields: fieldsProp,
  disabled = false,
  className,
  fileUploadMode,
}: SchemaFieldsSectionProps) {
  const t = useTranslations("chat");
  const {
    parsedSchema,
    formState,
    displayState,
    setFieldValue,
    setFieldDisplayValue,
    advancedExpanded,
    setAdvancedExpanded,
  } = schemaUI;

  const { optionalFields, rawSchema } = parsedSchema;

  // Use explicit fields prop if provided, otherwise fall back to optionalFields
  const displayFields = fieldsProp ?? optionalFields;

  // Don't render if no fields to display
  if (!displayFields.length || !rawSchema) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={cn("px-4 pt-3", className)}
      >
        <div className="border-border/50 -mx-4 space-y-2 border-b px-4 pb-3">
          <button
            type="button"
            onClick={() => setAdvancedExpanded(!advancedExpanded)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-xs font-medium transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("form.advancedInput")}</span>
            <motion.span
              animate={{ rotate: advancedExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
            <span className="text-muted-foreground/60 text-xs">
              ({displayFields.length})
            </span>
          </button>

          <AnimatePresence initial={false}>
            {advancedExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="border-muted max-h-[200px] space-y-2 overflow-y-auto border-l-2 pt-1 pl-3">
                  {displayFields.map((field) => (
                    <SchemaField
                      key={field.name}
                      field={field}
                      rootSchema={rawSchema}
                      value={formState[field.name]}
                      displayValue={displayState[field.name]}
                      onChange={(value) => setFieldValue(field.name, value)}
                      onDisplayValueChange={(value) =>
                        setFieldDisplayValue(field.name, value)
                      }
                      disabled={disabled}
                      compact
                      fileUploadMode={fileUploadMode}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
