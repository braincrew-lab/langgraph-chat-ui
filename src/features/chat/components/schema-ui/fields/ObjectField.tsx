import React, { useCallback, useMemo } from "react";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ObjectFieldProps } from "./types";
import type { SchemaFieldConfig, FieldValue } from "@/types/schema-ui";

// Forward declaration for recursive SchemaField
// This will be imported dynamically to avoid circular dependencies
interface SchemaFieldProps {
  field: SchemaFieldConfig;
  rootSchema: ObjectFieldProps["rootSchema"];
  value: FieldValue;
  onChange: (value: FieldValue) => void;
  disabled: boolean;
  compact: boolean;
}

type SchemaFieldComponent = React.FC<SchemaFieldProps>;

// This will be set by SchemaField.tsx
let SchemaFieldRef: SchemaFieldComponent | null = null;

export function setSchemaFieldRef(ref: SchemaFieldComponent) {
  SchemaFieldRef = ref;
}

export function ObjectField({
  field,
  rootSchema,
  value,
  onChange,
  disabled,
  compact,
}: ObjectFieldProps) {
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
  if (hasNestedProperties && resolvedSchema.properties && SchemaFieldRef) {
    const nestedRequired = new Set(resolvedSchema.required || []);
    const currentValue = value && typeof value === "object" ? value : {};
    const FieldComponent = SchemaFieldRef;

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
              <FieldComponent
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
