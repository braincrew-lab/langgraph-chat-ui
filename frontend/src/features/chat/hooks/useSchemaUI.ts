/**
 * Custom hook for managing schema-based UI state
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAssistantConfig } from "@/shared/hooks/useAssistantConfig";
import { extractDisplayName } from "@/lib/utils/file-upload";
import type {
  ParsedInputSchema,
  FormState,
  FieldValue,
  JSONSchema,
  SchemaFieldConfig,
} from "@/types/schema-ui";
import {
  parseInputSchema,
  getDefaultValue,
  validateFormState,
  buildSubmitPayload,
} from "@/lib/utils/schema";

export interface UseSchemaUIReturn {
  /** Parsed schema information */
  parsedSchema: ParsedInputSchema;
  /** Current form state */
  formState: FormState;
  /** Display-only field state (e.g. selected file names) */
  displayState: FormState;
  /** Set a single field value */
  setFieldValue: (fieldName: string, value: FieldValue) => void;
  /** Set display-only metadata for a field (e.g. selected file names) */
  setFieldDisplayValue: (fieldName: string, value: FieldValue) => void;
  /** Set multiple field values at once */
  setFieldValues: (values: FormState) => void;
  /** Get the submit payload (with messages excluded) */
  getSubmitPayload: () => Record<string, FieldValue>;
  /** Get display-only field metadata snapshot */
  getDisplayPayload: () => Record<string, FieldValue>;
  /** Reset form to default values */
  resetForm: () => void;
  /** Whether all required fields are filled */
  isFormValid: boolean;
  /** Whether advanced options section is expanded */
  advancedExpanded: boolean;
  /** Toggle advanced options section */
  setAdvancedExpanded: (expanded: boolean) => void;
  /** Whether schema is loading */
  isLoading: boolean;
  /** Whether schema has any dynamic fields (non-messages fields) */
  hasDynamicFields: boolean;
}

function isFileField(field: SchemaFieldConfig): boolean {
  const nameContainsFile = field.name.toLowerCase().includes("file");
  const schema = field.resolvedSchema;
  const fieldType = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const isStringType = fieldType === "string";
  const isStringArrayType =
    fieldType === "array" && schema.items?.type === "string";
  return nameContainsFile && (isStringType || isStringArrayType);
}

function toDisplayValue(value: FieldValue): FieldValue {
  if (typeof value === "string") {
    return extractDisplayName(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === "string" ? extractDisplayName(item) : item,
    );
  }

  return value;
}

function buildInitialDisplayState(
  fields: SchemaFieldConfig[],
  rawSchema: JSONSchema | null,
): FormState {
  if (!rawSchema) return {};

  const initialDisplayState: FormState = {};

  for (const field of fields) {
    if (!isFileField(field)) continue;

    const defaultValue = getDefaultValue(field.schema, rawSchema);
    if (defaultValue !== undefined) {
      initialDisplayState[field.name] = toDisplayValue(
        defaultValue as FieldValue,
      );
    }
  }

  return initialDisplayState;
}

/**
 * Hook for managing schema-based dynamic UI
 */
export function useSchemaUI(): UseSchemaUIReturn {
  const { schemas, isLoading: schemasLoading } = useAssistantConfig();
  const [formState, setFormState] = useState<FormState>({});
  const [displayState, setDisplayState] = useState<FormState>({});
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Parse the input schema
  const parsedSchema = useMemo((): ParsedInputSchema => {
    if (!schemas?.input_schema) {
      return {
        uiMode: "chat",
        requiredFields: [],
        optionalFields: [],
        normalFields: [],
        notRequiredFields: [],
        hasMessages: true,
        rawSchema: null,
      };
    }
    return parseInputSchema(schemas.input_schema as JSONSchema);
  }, [schemas?.input_schema]);

  // Initialize form state with defaults when schema changes
  useEffect(() => {
    if (!parsedSchema.rawSchema) {
      return;
    }

    const initialState: FormState = {};
    const allFields = [
      ...parsedSchema.requiredFields,
      ...parsedSchema.optionalFields,
    ];

    for (const field of allFields) {
      const defaultValue = getDefaultValue(
        field.schema,
        parsedSchema.rawSchema,
      );
      if (defaultValue !== undefined) {
        initialState[field.name] = defaultValue;
      }
    }

    setFormState(initialState);
    setDisplayState(
      buildInitialDisplayState(allFields, parsedSchema.rawSchema),
    );
  }, [parsedSchema]);

  // Set a single field value
  const setFieldValue = useCallback((fieldName: string, value: FieldValue) => {
    setFormState((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  const setFieldDisplayValue = useCallback(
    (fieldName: string, value: FieldValue) => {
      setDisplayState((prev) => ({
        ...prev,
        [fieldName]: value,
      }));
    },
    [],
  );

  // Set multiple field values at once
  const setFieldValues = useCallback((values: FormState) => {
    setFormState((prev) => ({
      ...prev,
      ...values,
    }));
  }, []);

  // Get submit payload
  const getSubmitPayload = useCallback((): Record<string, FieldValue> => {
    return buildSubmitPayload(
      formState,
      parsedSchema.requiredFields,
      parsedSchema.optionalFields,
    );
  }, [formState, parsedSchema.requiredFields, parsedSchema.optionalFields]);

  const getDisplayPayload = useCallback((): Record<string, FieldValue> => {
    return displayState;
  }, [displayState]);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    if (!parsedSchema.rawSchema) {
      setFormState({});
      return;
    }

    const initialState: FormState = {};
    const allFields = [
      ...parsedSchema.requiredFields,
      ...parsedSchema.optionalFields,
    ];

    for (const field of allFields) {
      const defaultValue = getDefaultValue(
        field.schema,
        parsedSchema.rawSchema,
      );
      if (defaultValue !== undefined) {
        initialState[field.name] = defaultValue;
      }
    }

    setFormState(initialState);
    setDisplayState(
      buildInitialDisplayState(allFields, parsedSchema.rawSchema),
    );
    setAdvancedExpanded(false);
  }, [parsedSchema]);

  // Validate form
  const isFormValid = useMemo(() => {
    return validateFormState(formState, parsedSchema.requiredFields);
  }, [formState, parsedSchema.requiredFields]);

  // Check if there are any dynamic fields
  const hasDynamicFields = useMemo(() => {
    return (
      parsedSchema.requiredFields.length > 0 ||
      parsedSchema.optionalFields.length > 0
    );
  }, [parsedSchema.requiredFields, parsedSchema.optionalFields]);

  return {
    parsedSchema,
    formState,
    displayState,
    setFieldValue,
    setFieldDisplayValue,
    setFieldValues,
    getSubmitPayload,
    getDisplayPayload,
    resetForm,
    isFormValid,
    advancedExpanded,
    setAdvancedExpanded,
    isLoading: schemasLoading,
    hasDynamicFields,
  };
}
