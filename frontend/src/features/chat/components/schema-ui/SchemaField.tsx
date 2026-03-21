/**
 * Schema Field Component
 * Renders appropriate UI controls based on JSON Schema field type
 */

import { useEffect } from "react";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  SchemaFieldConfig,
  FieldValue,
  JSONSchema,
  SchemaFieldType,
} from "@/types/schema-ui";
import {
  getFieldType,
  getFieldLabel,
  getFieldDescription,
  getArrayItemSchema,
} from "@/lib/utils/schema";
import {
  StringField,
  NumberField,
  BooleanField,
  EnumField,
  ArrayField,
  ObjectField,
  FileField,
  FileArrayField,
  setSchemaFieldRef,
} from "./fields";

/**
 * Check if a field should use file upload UI
 * Rule: field name contains "file" (case-insensitive) AND type is string or string[]
 */
export function isFileField(
  fieldName: string,
  fieldType: SchemaFieldType,
  itemType?: SchemaFieldType,
): boolean {
  const nameContainsFile = fieldName.toLowerCase().includes("file");
  if (!nameContainsFile) return false;

  // Single string field
  if (fieldType === "string") return true;

  // Array of strings
  if (fieldType === "array" && itemType === "string") return true;

  return false;
}

interface SchemaFieldProps {
  field: SchemaFieldConfig;
  rootSchema: JSONSchema;
  value: FieldValue;
  displayValue?: FieldValue;
  onChange: (value: FieldValue) => void;
  onDisplayValueChange?: (value: FieldValue) => void;
  disabled?: boolean;
  compact?: boolean;
  fileUploadMode?: "base64" | "url";
}

export function SchemaField({
  field,
  rootSchema,
  value,
  displayValue,
  onChange,
  onDisplayValueChange,
  disabled = false,
  compact = false,
  fileUploadMode,
}: SchemaFieldProps) {
  // Set the SchemaField reference for ObjectField to use for recursive rendering
  useEffect(() => {
    setSchemaFieldRef(SchemaField);
  }, []);

  const fieldType = getFieldType(field.schema, rootSchema);
  const label = getFieldLabel(field);
  const description = getFieldDescription(field);

  // Check for array item type (for file array detection)
  const itemSchema =
    fieldType === "array" ? getArrayItemSchema(field, rootSchema) : null;
  const itemType = itemSchema
    ? getFieldType(itemSchema, rootSchema)
    : undefined;

  // Check if this is a file field
  const isFile = isFileField(field.name, fieldType, itemType);

  const renderField = () => {
    // File upload UI (rule-based: name contains "file" + type is string or string[])
    if (isFile) {
      if (fieldType === "array") {
        return (
          <FileArrayField
            field={field}
            value={value as string[]}
            displayValue={displayValue as string[] | undefined}
            onChange={onChange}
            onDisplayValueChange={onDisplayValueChange}
            disabled={disabled}
            compact={compact}
            fileUploadMode={fileUploadMode}
          />
        );
      }
      return (
        <FileField
          field={field}
          value={value as string}
          displayValue={displayValue as string | undefined}
          onChange={onChange}
          onDisplayValueChange={onDisplayValueChange}
          disabled={disabled}
          compact={compact}
          fileUploadMode={fileUploadMode}
        />
      );
    }

    switch (fieldType) {
      case "string":
        return (
          <StringField
            field={field}
            value={value as string}
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
      case "number":
      case "integer":
        return (
          <NumberField
            field={field}
            fieldType={fieldType}
            value={value as number}
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
      case "boolean":
        return (
          <BooleanField
            field={field}
            value={value as boolean}
            onChange={onChange}
            disabled={disabled}
            label={label}
            compact={compact}
          />
        );
      case "enum":
        return (
          <EnumField
            field={field}
            value={value}
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
      case "array":
        return (
          <ArrayField
            field={field}
            rootSchema={rootSchema}
            value={value as (string | number)[]}
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
      case "object":
        return (
          <ObjectField
            field={field}
            rootSchema={rootSchema}
            value={value as Record<string, unknown>}
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
      default:
        return (
          <StringField
            field={field}
            value={String(value ?? "")}
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
    }
  };

  // Boolean field has its own label layout
  if (fieldType === "boolean") {
    return (
      <div
        className={cn(
          "min-w-0 space-y-1",
          compact ? "space-y-0.5" : "space-y-2",
        )}
      >
        {renderField()}
        {description && !compact && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn("min-w-0 space-y-1", compact ? "space-y-0.5" : "space-y-2")}
    >
      <Label
        className={cn(
          "text-sm font-medium",
          field.isRequired &&
            "after:ml-0.5 after:text-red-500 after:content-['*']",
        )}
      >
        {label}
      </Label>
      {renderField()}
      {description && !compact && (
        <p className="text-muted-foreground text-xs">{description}</p>
      )}
    </div>
  );
}
