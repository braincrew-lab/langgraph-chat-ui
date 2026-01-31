/**
 * Schema Field Component
 * Renders appropriate UI controls based on JSON Schema field type
 */

import React, { useCallback, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, Upload, File } from "lucide-react";
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
} from "@/lib/schema-utils";

/**
 * Check if a field should use file upload UI
 * Rule: field name contains "file" (case-insensitive) AND type is string or string[]
 */
function isFileField(
  fieldName: string,
  fieldType: SchemaFieldType,
  itemType?: SchemaFieldType
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
  onChange: (value: FieldValue) => void;
  disabled?: boolean;
  compact?: boolean;
}

export function SchemaField({
  field,
  rootSchema,
  value,
  onChange,
  disabled = false,
  compact = false,
}: SchemaFieldProps) {
  const fieldType = getFieldType(field.schema, rootSchema);
  const label = getFieldLabel(field);
  const description = getFieldDescription(field);

  // Check for array item type (for file array detection)
  const itemSchema = fieldType === "array" ? getArrayItemSchema(field, rootSchema) : null;
  const itemType = itemSchema ? getFieldType(itemSchema, rootSchema) : undefined;

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
            onChange={onChange}
            disabled={disabled}
            compact={compact}
          />
        );
      }
      return (
        <FileField
          field={field}
          value={value as string}
          onChange={onChange}
          disabled={disabled}
          compact={compact}
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
      <div className={cn("space-y-1", compact ? "space-y-0.5" : "space-y-2")}>
        {renderField()}
        {description && !compact && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", compact ? "space-y-0.5" : "space-y-2")}>
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

// String field component
function StringField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  value: string;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  // Use textarea for longer text or if description suggests it
  const useTextarea =
    field.resolvedSchema.maxLength !== undefined &&
    field.resolvedSchema.maxLength > 200;

  if (useTextarea) {
    return (
      <Textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={field.resolvedSchema.description}
        className={cn(compact && "h-20")}
      />
    );
  }

  return (
    <Textarea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder={field.resolvedSchema.description}
      rows={2}
      className={cn("resize-none", compact && "text-sm")}
    />
  );
}

// Number field component
function NumberField({
  field,
  fieldType,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  fieldType: SchemaFieldType;
  value: number;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === "") {
        onChange(undefined);
        return;
      }
      const num = fieldType === "integer" ? parseInt(val, 10) : parseFloat(val);
      if (!isNaN(num)) {
        onChange(num);
      }
    },
    [onChange, fieldType],
  );

  return (
    <Input
      type="number"
      value={value ?? ""}
      onChange={handleChange}
      disabled={disabled}
      placeholder={field.resolvedSchema.description}
      min={field.resolvedSchema.minimum}
      max={field.resolvedSchema.maximum}
      step={fieldType === "integer" ? 1 : "any"}
      className={cn(compact && "h-8 text-sm")}
    />
  );
}

// Boolean field component
function BooleanField({
  field,
  value,
  onChange,
  disabled,
  label,
  compact,
}: {
  field: SchemaFieldConfig;
  value: boolean;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  label: string;
  compact: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
      <Switch
        checked={value ?? false}
        onCheckedChange={(checked) => onChange(checked)}
        disabled={disabled}
      />
      <Label
        className={cn(
          "cursor-pointer text-sm font-medium",
          field.isRequired &&
            "after:ml-0.5 after:text-red-500 after:content-['*']",
        )}
      >
        {label}
      </Label>
    </div>
  );
}

// Enum field component (select)
function EnumField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const enumValues = field.resolvedSchema.enum ?? [];

  return (
    <select
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "border-input focus:ring-ring flex w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus:ring-1 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        compact && "h-8 py-1 text-sm",
      )}
    >
      <option value="">Select...</option>
      {enumValues.map((enumValue, idx) => (
        <option
          key={idx}
          value={String(enumValue)}
        >
          {String(enumValue)}
        </option>
      ))}
    </select>
  );
}

// Array field component (dynamic list)
function ArrayField({
  field,
  rootSchema,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  rootSchema: JSONSchema;
  value: (string | number)[];
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const items = useMemo(
    (): (string | number)[] => (Array.isArray(value) ? value : []),
    [value],
  );
  const itemSchema = getArrayItemSchema(field, rootSchema);
  const itemType = itemSchema ? getFieldType(itemSchema, rootSchema) : "string";

  const handleAdd = useCallback(() => {
    const newValue: string | number =
      itemType === "number" || itemType === "integer" ? 0 : "";
    const newItems: (string | number)[] = [...items, newValue];
    onChange(newItems);
  }, [items, onChange, itemType]);

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange],
  );

  const handleItemChange = useCallback(
    (index: number, newValue: string | number) => {
      const newItems = [...items];
      newItems[index] = newValue;
      onChange(newItems);
    },
    [items, onChange],
  );

  return (
    <div className="mt-2 space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-2"
        >
          <Input
            type={
              itemType === "number" || itemType === "integer"
                ? "number"
                : "text"
            }
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            disabled={disabled}
            placeholder={`Item ${index + 1}`}
            className={cn("flex-1", compact && "h-8 text-sm")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(index)}
            disabled={disabled}
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled}
        className={cn("w-full", compact && "h-7 text-xs")}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add Item
      </Button>
    </div>
  );
}

// Object field component (JSON editor or nested fields)
function ObjectField({
  field,
  rootSchema,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  rootSchema: JSONSchema;
  value: Record<string, unknown>;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const resolvedSchema = field.resolvedSchema;
  const hasNestedProperties =
    resolvedSchema.properties &&
    Object.keys(resolvedSchema.properties).length > 0;

  // Hooks must be called unconditionally at the top level
  const jsonValue = useMemo(() => {
    if (!value || Object.keys(value).length === 0) {
      return "";
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return "";
    }
  }, [value]);

  const handleJsonChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      if (!text.trim()) {
        onChange({});
        return;
      }
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed === "object" && parsed !== null) {
          onChange(parsed);
        }
      } catch {
        // Invalid JSON, don't update
      }
    },
    [onChange],
  );

  // If the object has defined properties, render nested fields
  if (hasNestedProperties && resolvedSchema.properties) {
    const nestedRequired = new Set(resolvedSchema.required || []);
    const currentValue = value && typeof value === "object" ? value : {};

    return (
      <div
        className={cn(
          "space-y-3 rounded-lg border p-3",
          compact && "space-y-2 p-2",
        )}
      >
        {Object.entries(resolvedSchema.properties).map(
          ([propName, propSchema]) => {
            const nestedField: SchemaFieldConfig = {
              name: propName,
              schema: propSchema,
              resolvedSchema: propSchema,
              isRequired: nestedRequired.has(propName),
            };

            return (
              <SchemaField
                key={propName}
                field={nestedField}
                rootSchema={rootSchema}
                value={currentValue[propName] as FieldValue}
                onChange={(newValue) => {
                  const updated = { ...currentValue, [propName]: newValue };
                  // Remove undefined values
                  if (newValue === undefined || newValue === "") {
                    delete updated[propName];
                  }
                  onChange(updated);
                }}
                disabled={disabled}
                compact={compact}
              />
            );
          },
        )}
      </div>
    );
  }

  // Otherwise, show a JSON textarea for free-form object input
  return (
    <Textarea
      value={jsonValue}
      onChange={handleJsonChange}
      disabled={disabled}
      placeholder={field.resolvedSchema.description || "Enter JSON object..."}
      className={cn("font-mono text-sm", compact ? "h-20" : "h-32")}
    />
  );
}

// File field component (single file upload -> string path)
function FileField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  value: string;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Store the file name as the value
        // In a real implementation, you might want to upload and get a URL/path
        onChange(file.name);
      }
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onChange]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        id={`file-${field.name}`}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={cn("flex-1 justify-start", compact && "h-8 text-sm")}
      >
        <Upload className="mr-2 h-4 w-4" />
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span className="text-muted-foreground">파일 선택...</span>
        )}
      </Button>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={disabled}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// File array field component (multiple files upload -> string[] paths)
function FileArrayField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: {
  field: SchemaFieldConfig;
  value: string[];
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo((): string[] => (Array.isArray(value) ? value : []), [value]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const newFileNames = Array.from(files).map((f) => f.name);
        onChange([...items, ...newFileNames]);
      }
      // Reset input for re-selection
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [items, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange]
  );

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-3",
          "min-h-[80px] max-h-[120px] overflow-y-auto",
          "hover:border-primary/50 hover:bg-muted/30 transition-colors",
          items.length === 0 && "flex items-center justify-center",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {items.length === 0 ? (
          <span className="text-muted-foreground text-sm">
            클릭하여 파일 선택...
          </span>
        ) : (
          <div className="space-y-1">
            {items.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-background px-3 py-1.5",
                  compact && "py-1"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={cn("flex-1 truncate text-sm", compact && "text-xs")}>
                  {item}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className="h-6 w-6 shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
        multiple
        className="hidden"
        id={`files-${field.name}`}
      />
    </div>
  );
}
