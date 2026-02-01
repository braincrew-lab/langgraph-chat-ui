/**
 * Utility functions for parsing and working with JSON Schema
 */

import type {
  JSONSchema,
  JSONSchemaProperty,
  UIMode,
  ParsedInputSchema,
  SchemaFieldConfig,
  SchemaFieldType,
  FieldValue,
} from "@/types/schema-ui";

/**
 * Resolve $ref references in a JSON Schema
 */
export function resolveRef(
  schema: JSONSchemaProperty,
  rootSchema: JSONSchema
): JSONSchemaProperty {
  if (!schema.$ref) {
    return schema;
  }

  // Handle local references like "#/$defs/TypeName" or "#/definitions/TypeName"
  const refPath = schema.$ref;
  if (refPath.startsWith("#/")) {
    const pathParts = refPath.slice(2).split("/");
    let resolved: unknown = rootSchema;

    for (const part of pathParts) {
      if (resolved && typeof resolved === "object" && part in resolved) {
        resolved = (resolved as Record<string, unknown>)[part];
      } else {
        console.warn(`Could not resolve $ref: ${refPath}`);
        return schema;
      }
    }

    if (resolved && typeof resolved === "object") {
      // Recursively resolve in case the resolved schema also has $ref
      return resolveRef(resolved as JSONSchemaProperty, rootSchema);
    }
  }

  return schema;
}

/**
 * Resolve anyOf, oneOf, allOf and pick a reasonable schema
 * For anyOf/oneOf: prefer non-null type, or first option
 * For allOf: merge all schemas
 */
export function resolveCompositeSchema(
  schema: JSONSchemaProperty,
  rootSchema: JSONSchema
): JSONSchemaProperty {
  // First resolve any $ref
  let resolved = resolveRef(schema, rootSchema);

  // Handle anyOf
  if (resolved.anyOf && resolved.anyOf.length > 0) {
    // Filter out null types and pick the first non-null
    const nonNullSchemas = resolved.anyOf.filter((s) => {
      const r = resolveRef(s, rootSchema);
      return r.type !== "null";
    });
    if (nonNullSchemas.length > 0) {
      resolved = resolveCompositeSchema(nonNullSchemas[0], rootSchema);
    } else {
      resolved = resolveCompositeSchema(resolved.anyOf[0], rootSchema);
    }
  }

  // Handle oneOf (same logic as anyOf for our purposes)
  if (resolved.oneOf && resolved.oneOf.length > 0) {
    const nonNullSchemas = resolved.oneOf.filter((s) => {
      const r = resolveRef(s, rootSchema);
      return r.type !== "null";
    });
    if (nonNullSchemas.length > 0) {
      resolved = resolveCompositeSchema(nonNullSchemas[0], rootSchema);
    } else {
      resolved = resolveCompositeSchema(resolved.oneOf[0], rootSchema);
    }
  }

  // Handle allOf - merge schemas
  if (resolved.allOf && resolved.allOf.length > 0) {
    const merged: JSONSchemaProperty = {};
    for (const subSchema of resolved.allOf) {
      const resolvedSub = resolveCompositeSchema(subSchema, rootSchema);
      Object.assign(merged, resolvedSub);
    }
    resolved = merged;
  }

  return resolved;
}

/**
 * Detect UI mode based on input_schema
 * - 'chat' if 'messages' field exists (default when schema is missing/ambiguous)
 * - 'form' only when schema explicitly has properties without 'messages'
 */
export function detectUIMode(inputSchema: JSONSchema | null): UIMode {
  // 스키마가 없거나 properties가 없으면 기본 chat 모드
  if (!inputSchema || !inputSchema.properties) {
    return "chat";
  }

  // properties가 있는 경우에만 messages 필드 확인
  return "messages" in inputSchema.properties ? "chat" : "form";
}

/**
 * Check if the schema has a 'messages' field
 * Returns true (default chat mode) if schema is missing or ambiguous
 * Only returns false when schema explicitly has properties without 'messages'
 */
export function hasMessagesField(inputSchema: JSONSchema | null): boolean {
  // 스키마가 없으면 기본 chat 모드 (messages 포함)
  if (!inputSchema) {
    return true;
  }

  // properties가 정의되지 않았으면 기본 chat 모드
  if (!inputSchema.properties) {
    return true;
  }

  // properties가 있는 경우에만 messages 필드 존재 여부 확인
  return "messages" in inputSchema.properties;
}

/**
 * Get the field type from a JSON Schema property
 */
export function getFieldType(
  schema: JSONSchemaProperty,
  rootSchema: JSONSchema
): SchemaFieldType {
  const resolved = resolveCompositeSchema(schema, rootSchema);

  // Check for enum first
  if (resolved.enum && resolved.enum.length > 0) {
    return "enum";
  }

  // Handle type as string or array
  const type = Array.isArray(resolved.type)
    ? resolved.type.find((t) => t !== "null") || resolved.type[0]
    : resolved.type;

  switch (type) {
    case "string":
      return "string";
    case "number":
      return "number";
    case "integer":
      return "integer";
    case "boolean":
      return "boolean";
    case "array":
      return "array";
    case "object":
      return "object";
    default:
      return "unknown";
  }
}

/**
 * Get the default value for a field based on its type
 */
export function getDefaultValue(
  schema: JSONSchemaProperty,
  rootSchema: JSONSchema
): FieldValue {
  const resolved = resolveCompositeSchema(schema, rootSchema);

  // Use explicit default if provided
  if (resolved.default !== undefined) {
    return resolved.default as FieldValue;
  }

  const fieldType = getFieldType(schema, rootSchema);

  switch (fieldType) {
    case "string":
      return "";
    case "number":
    case "integer":
      return undefined;
    case "boolean":
      return false;
    case "array":
      return [];
    case "object":
      return {};
    case "enum":
      // Return first enum value as default
      return resolved.enum?.[0] as FieldValue;
    default:
      return undefined;
  }
}

/**
 * Parse input schema and categorize fields into required and optional
 */
export function parseInputSchema(
  inputSchema: JSONSchema | null
): ParsedInputSchema {
  const uiMode = detectUIMode(inputSchema);
  const hasMessages = hasMessagesField(inputSchema);

  if (!inputSchema || !inputSchema.properties) {
    return {
      uiMode,
      requiredFields: [],
      optionalFields: [],
      hasMessages,
      rawSchema: inputSchema,
    };
  }

  const requiredSet = new Set(inputSchema.required || []);
  const requiredFields: SchemaFieldConfig[] = [];
  const optionalFields: SchemaFieldConfig[] = [];

  // Fields to exclude from the form (handled separately)
  const excludedFields = new Set(["messages", "ui"]);

  for (const [name, schema] of Object.entries(inputSchema.properties)) {
    // Skip excluded fields
    if (excludedFields.has(name)) {
      continue;
    }

    const resolvedSchema = resolveCompositeSchema(schema, inputSchema);
    const fieldConfig: SchemaFieldConfig = {
      name,
      schema,
      resolvedSchema,
      isRequired: requiredSet.has(name),
    };

    if (fieldConfig.isRequired) {
      requiredFields.push(fieldConfig);
    } else {
      optionalFields.push(fieldConfig);
    }
  }

  return {
    uiMode,
    requiredFields,
    optionalFields,
    hasMessages,
    rawSchema: inputSchema,
  };
}

/**
 * Get a human-readable label for a field
 */
export function getFieldLabel(field: SchemaFieldConfig): string {
  return field.resolvedSchema.title || formatFieldName(field.name);
}

/**
 * Format a field name into a human-readable label
 * e.g., "pdf_paths" -> "Pdf Paths"
 */
export function formatFieldName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Get the description for a field
 */
export function getFieldDescription(
  field: SchemaFieldConfig
): string | undefined {
  return field.resolvedSchema.description;
}

/**
 * Check if a field value is empty
 */
export function isFieldEmpty(value: FieldValue): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value.trim() === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }
  return false;
}

/**
 * Validate a form state against required fields
 */
export function validateFormState(
  formState: Record<string, FieldValue>,
  requiredFields: SchemaFieldConfig[]
): boolean {
  for (const field of requiredFields) {
    const value = formState[field.name];
    if (isFieldEmpty(value)) {
      return false;
    }
  }
  return true;
}

/**
 * Build submit payload from form state (excluding empty optional fields)
 */
export function buildSubmitPayload(
  formState: Record<string, FieldValue>,
  requiredFields: SchemaFieldConfig[],
  optionalFields: SchemaFieldConfig[]
): Record<string, FieldValue> {
  const payload: Record<string, FieldValue> = {};

  // Always include required fields
  for (const field of requiredFields) {
    const value = formState[field.name];
    if (value !== undefined) {
      payload[field.name] = value;
    }
  }

  // Include optional fields only if they have values
  for (const field of optionalFields) {
    const value = formState[field.name];
    if (!isFieldEmpty(value)) {
      payload[field.name] = value;
    }
  }

  return payload;
}

/**
 * Get the array item schema for an array field
 */
export function getArrayItemSchema(
  field: SchemaFieldConfig,
  rootSchema: JSONSchema
): JSONSchemaProperty | null {
  const resolved = resolveCompositeSchema(field.schema, rootSchema);
  if (resolved.items) {
    return resolveCompositeSchema(resolved.items, rootSchema);
  }
  return null;
}
