/**
 * Inline Fields Section Component
 * Renders Required + Normal fields above the textarea in chat mode.
 * Required fields must be filled for submit; Normal fields are optional.
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SchemaField } from "./SchemaField";
import type {
  SchemaFieldConfig,
  FieldValue,
  JSONSchema,
} from "@/types/schema-ui";

interface InlineFieldsSectionProps {
  requiredFields: SchemaFieldConfig[];
  normalFields: SchemaFieldConfig[];
  rootSchema: JSONSchema;
  formState: Record<string, FieldValue>;
  displayState: Record<string, FieldValue>;
  onFieldChange: (name: string, value: FieldValue) => void;
  onDisplayValueChange: (name: string, value: FieldValue) => void;
  disabled?: boolean;
  fileUploadMode?: "base64" | "url";
}

export function InlineFieldsSection({
  requiredFields,
  normalFields,
  rootSchema,
  formState,
  displayState,
  onFieldChange,
  onDisplayValueChange,
  disabled = false,
  fileUploadMode,
}: InlineFieldsSectionProps) {
  const hasRequired = requiredFields.length > 0;
  const hasNormal = normalFields.length > 0;

  if (!hasRequired && !hasNormal) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.15 }}
        className="min-w-0 space-y-2 overflow-hidden px-4 pt-3"
      >
        {/* Required fields */}
        {hasRequired && (
          <div className="space-y-2">
            {requiredFields.map((field) => (
              <SchemaField
                key={field.name}
                field={field}
                rootSchema={rootSchema}
                value={formState[field.name]}
                displayValue={displayState[field.name]}
                onChange={(value) => onFieldChange(field.name, value)}
                onDisplayValueChange={(value) =>
                  onDisplayValueChange(field.name, value)
                }
                disabled={disabled}
                compact
                fileUploadMode={fileUploadMode}
              />
            ))}
          </div>
        )}

        {/* Separator between required and normal sections */}
        {hasRequired && hasNormal && (
          <div className="border-border/30 border-t" />
        )}

        {/* Normal (optional) fields */}
        {hasNormal && (
          <div className="space-y-2">
            {normalFields.map((field) => (
              <SchemaField
                key={field.name}
                field={field}
                rootSchema={rootSchema}
                value={formState[field.name]}
                displayValue={displayState[field.name]}
                onChange={(value) => onFieldChange(field.name, value)}
                onDisplayValueChange={(value) =>
                  onDisplayValueChange(field.name, value)
                }
                disabled={disabled}
                compact
                fileUploadMode={fileUploadMode}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
