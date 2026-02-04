/**
 * Custom hook for managing schema-based UI state
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useAssistantConfig } from "@/shared/hooks/useAssistantConfig";
import type {
  ParsedInputSchema,
  FormState,
  FieldValue,
  JSONSchema,
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
  /** Set a single field value */
  setFieldValue: (fieldName: string, value: FieldValue) => void;
  /** Set multiple field values at once */
  setFieldValues: (values: FormState) => void;
  /** Get the submit payload (with messages excluded) */
  getSubmitPayload: () => Record<string, FieldValue>;
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

/**
 * Hook for managing schema-based dynamic UI
 */
export function useSchemaUI(): UseSchemaUIReturn {
  const { schemas, isLoading: schemasLoading } = useAssistantConfig();
  const [formState, setFormState] = useState<FormState>({});
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Parse the input schema
  const parsedSchema = useMemo((): ParsedInputSchema => {
    if (!schemas?.input_schema) {
      return {
        uiMode: "chat",
        requiredFields: [],
        optionalFields: [],
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
  }, [parsedSchema]);

  // Set a single field value
  const setFieldValue = useCallback((fieldName: string, value: FieldValue) => {
    setFormState((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

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
    setFieldValue,
    setFieldValues,
    getSubmitPayload,
    resetForm,
    isFormValid,
    advancedExpanded,
    setAdvancedExpanded,
    isLoading: schemasLoading,
    hasDynamicFields,
  };
}
