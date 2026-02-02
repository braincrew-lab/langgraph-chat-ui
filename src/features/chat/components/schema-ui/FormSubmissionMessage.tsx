/**
 * Form Submission Message Component
 * Displays submitted form data in the thread (similar to HumanMessage style)
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, FileText, File } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormState, SchemaFieldConfig } from "@/types/schema-ui";
import { getFieldLabel } from "@/lib/utils/schema";

// Check if a field is a file field (name contains "file" and type is string or string array)
function isFileField(field: SchemaFieldConfig): boolean {
  const nameContainsFile = field.name.toLowerCase().includes("file");
  const schema = field.resolvedSchema;
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const isStringType = fieldType === "string";
  const isStringArrayType =
    fieldType === "array" && schema.items?.type === "string";
  return nameContainsFile && (isStringType || isStringArrayType);
}

interface FormSubmissionMessageProps {
  formData: FormState;
  fields: SchemaFieldConfig[];
  timestamp?: Date;
  className?: string;
}

export function FormSubmissionMessage({
  formData,
  fields,
  timestamp,
  className,
}: FormSubmissionMessageProps) {
  const [expanded, setExpanded] = useState(true);

  // Filter out empty fields
  const filledFields = fields.filter((field) => {
    const value = formData[field.name];
    if (value === null || value === undefined) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    return true;
  });

  if (filledFields.length === 0) {
    return null;
  }

  // Get summary (first few filled fields)
  const summaryFields = filledFields.slice(0, 2);
  const remainingCount = filledFields.length - summaryFields.length;

  return (
    <div className={cn("group ml-auto flex items-center gap-2", className)}>
      <div className="flex flex-col gap-2">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-muted border-border/30 max-w-2xl rounded-3xl border px-5 py-3 shadow-sm"
        >
          {/* Header */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-foreground flex w-full items-center gap-2 text-left text-sm font-medium"
          >
            <FileText className="text-muted-foreground h-4 w-4" />
            <span>폼 데이터 제출</span>
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="ml-auto"
            >
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            </motion.span>
          </button>

          {/* Content */}
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-border/30 mt-3 space-y-2 border-t pt-3"
            >
              {filledFields.map((field) => (
                <FieldDisplay
                  key={field.name}
                  field={field}
                  value={formData[field.name]}
                />
              ))}
            </motion.div>
          ) : (
            <div className="text-muted-foreground mt-2 text-sm">
              {summaryFields.map((field, idx) => (
                <span key={field.name}>
                  {getFieldLabel(field)}:{" "}
                  {formatValue(formData[field.name], field)}
                  {idx < summaryFields.length - 1 && ", "}
                </span>
              ))}
              {remainingCount > 0 && (
                <span className="text-muted-foreground/60">
                  {" "}
                  외 {remainingCount}개
                </span>
              )}
            </div>
          )}

          {/* Timestamp */}
          {timestamp && (
            <div className="text-muted-foreground/60 mt-2 text-xs">
              {timestamp.toLocaleTimeString()}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// Individual field display
function FieldDisplay({
  field,
  value,
}: {
  field: SchemaFieldConfig;
  value: unknown;
}) {
  const label = getFieldLabel(field);
  const isObject =
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isFile = isFileField(field);

  // File field - special UI
  if (isFile) {
    const files = Array.isArray(value) ? value : [value];
    const validFiles = files.filter(
      (f): f is string => typeof f === "string" && f.trim() !== "",
    );

    if (validFiles.length === 0) return null;

    return (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        <div className="flex flex-col gap-1">
          {validFiles.map((filePath, idx) => {
            const fileName = filePath.split("/").pop() || filePath;
            return (
              <div
                key={idx}
                className="text-foreground bg-background/50 border-border/30 flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
              >
                <File className="h-4 w-4 flex-shrink-0 text-blue-500" />
                <span
                  className="truncate"
                  title={filePath}
                >
                  {fileName}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // String array - use line breaks
  if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
    const stringArray = value as string[];
    if (stringArray.length === 0) return null;

    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground text-xs font-medium">
          {label}
        </span>
        <div className="text-foreground bg-background/50 space-y-1 rounded-md p-2 text-sm">
          {stringArray.map((item, idx) => (
            <div
              key={idx}
              className="break-words"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formattedValue = formatValue(value);

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {isObject && Object.keys(value).length > 0 ? (
        <pre className="text-foreground bg-background/50 overflow-x-auto rounded-md p-2 font-mono text-sm whitespace-pre-wrap">
          {formattedValue}
        </pre>
      ) : (
        <span className="text-foreground text-sm break-words">
          {formattedValue}
        </span>
      )}
    </div>
  );
}

// Format value for display (used in collapsed summary)
function formatValue(value: unknown, field?: SchemaFieldConfig): string {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "boolean") {
    return value ? "예" : "아니오";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "-";
    // For file fields, show count
    if (field && isFileField(field)) {
      return `${value.length}개 파일`;
    }
    // For string arrays, show count if more than 2 items
    if (value.length > 2 && value.every((v) => typeof v === "string")) {
      return `${value.length}개 항목`;
    }
    return value.join(", ");
  }
  if (typeof value === "object") {
    // Check if object is empty
    if (Object.keys(value).length === 0) return "-";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  // For single file field, show filename only
  if (field && isFileField(field) && typeof value === "string") {
    return value.split("/").pop() || value;
  }
  return String(value);
}
