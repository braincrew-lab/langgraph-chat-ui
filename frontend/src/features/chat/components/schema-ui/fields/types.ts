import type {
  SchemaFieldConfig,
  FieldValue,
  JSONSchema,
  SchemaFieldType,
} from "@/types/schema-ui";

export interface BaseFieldProps {
  field: SchemaFieldConfig;
  disabled: boolean;
  compact: boolean;
}

export interface StringFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: FieldValue) => void;
}

export interface NumberFieldProps extends BaseFieldProps {
  fieldType: SchemaFieldType;
  value: number;
  onChange: (value: FieldValue) => void;
}

export interface BooleanFieldProps extends BaseFieldProps {
  value: boolean;
  onChange: (value: FieldValue) => void;
  label: string;
}

export interface EnumFieldProps extends BaseFieldProps {
  value: FieldValue;
  onChange: (value: FieldValue) => void;
}

export interface ArrayFieldProps extends BaseFieldProps {
  rootSchema: JSONSchema;
  value: (string | number)[];
  onChange: (value: FieldValue) => void;
}

export interface ObjectFieldProps extends BaseFieldProps {
  rootSchema: JSONSchema;
  value: Record<string, unknown>;
  onChange: (value: FieldValue) => void;
}

export interface FileFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: FieldValue) => void;
  fileUploadMode?: "base64" | "url";
}

export interface FileArrayFieldProps extends BaseFieldProps {
  value: string[];
  onChange: (value: FieldValue) => void;
  fileUploadMode?: "base64" | "url";
}
