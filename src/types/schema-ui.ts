/**
 * JSON Schema type definitions for dynamic UI generation
 */

export interface JSONSchemaProperty {
  type?: string | string[];
  title?: string;
  description?: string;
  default?: unknown;
  enum?: unknown[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  $ref?: string;
  anyOf?: JSONSchemaProperty[];
  allOf?: JSONSchemaProperty[];
  oneOf?: JSONSchemaProperty[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: string;
}

export interface JSONSchema {
  type?: string;
  title?: string;
  description?: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  $defs?: Record<string, JSONSchemaProperty>;
  definitions?: Record<string, JSONSchemaProperty>;
}

/**
 * UI mode based on input_schema structure
 * - chat: has 'messages' field (standard chat interface)
 * - form: no 'messages' field (form-based input)
 */
export type UIMode = "chat" | "form";

/**
 * Configuration for a single schema field
 */
export interface SchemaFieldConfig {
  name: string;
  schema: JSONSchemaProperty;
  resolvedSchema: JSONSchemaProperty;
  isRequired: boolean;
}

/**
 * Parsed input schema with categorized fields
 */
export interface ParsedInputSchema {
  uiMode: UIMode;
  requiredFields: SchemaFieldConfig[];
  optionalFields: SchemaFieldConfig[];
  hasMessages: boolean;
  rawSchema: JSONSchema | null;
}

/**
 * Field value types for form state
 */
export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | (string | number)[]
  | Record<string, unknown>
  | null
  | undefined;

/**
 * Form state mapping field names to values
 */
export interface FormState {
  [fieldName: string]: FieldValue;
}

/**
 * Field type enum for rendering different UI components
 */
export type SchemaFieldType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "enum"
  | "unknown";
