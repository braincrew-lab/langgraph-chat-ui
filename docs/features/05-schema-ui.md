# Schema-based UI

## Overview

Schema-based UI dynamically generates input forms from LangGraph assistant `input_schema`. It detects whether the assistant expects a chat interface (with messages) or a form interface (without messages), and renders appropriate UI components. This enables the same chat UI to work with diverse LangGraph agents without code changes.

## File Map

| File | Lines | Role |
|------|-------|------|
| `src/hooks/useSchemaUI.ts` | 174 | Schema parsing hook, form state management |
| `src/lib/schema-utils.ts` | 362 | JSON Schema parsing utilities |
| `src/types/schema-ui.ts` | 97 | Type definitions for schema and form state |
| `src/components/thread/schema-ui/UnifiedInputArea.tsx` | 308 | Main input component (chat/form modes) |
| `src/components/thread/schema-ui/SchemaField.tsx` | ~200 | Individual field renderer |
| `src/components/thread/schema-ui/SchemaFieldsSection.tsx` | ~100 | Optional fields section (advanced) |
| `src/components/thread/schema-ui/ActionBar.tsx` | ~150 | Submit button and toolbar |
| `src/components/thread/schema-ui/FormSubmissionMessage.tsx` | ~50 | Form submission display |

## Data Flow

### Schema Detection Flow

```
AssistantConfigProvider
         ↓
schemas.input_schema (from LangGraph SDK)
         ↓
parseInputSchema() (lib/schema-utils.ts)
├─ detectUIMode()
│   ├─ "messages" in properties → "chat" mode
│   └─ no "messages" → "form" mode
├─ resolveRef() → resolve $ref references
├─ resolveCompositeSchema() → handle anyOf/oneOf/allOf
└─ categorize fields:
    ├─ requiredFields (in schema.required)
    └─ optionalFields (not in required)
         ↓
useSchemaUI() hook
├─ parsedSchema: ParsedInputSchema
├─ formState: Record<fieldName, value>
├─ setFieldValue(name, value)
├─ getSubmitPayload()
└─ isFormValid
         ↓
UnifiedInputArea component
├─ Form mode: required fields + optional section
└─ Chat mode: textarea + file upload
```

### UI Mode Determination

```typescript
// schema-utils.ts:107-113
export function detectUIMode(inputSchema: JSONSchema | null): UIMode {
  if (!inputSchema || !inputSchema.properties) {
    return "chat";
  }
  return "messages" in inputSchema.properties ? "chat" : "form";
}
```

| Schema Properties | UI Mode | Description |
|-------------------|---------|-------------|
| Contains `messages` | Chat | Standard chat with textarea |
| No `messages` | Form | Dynamic form fields |

## Logic Analysis

### JSON Schema $ref Resolution (`schema-utils.ts:18-48`)

```typescript
function resolveRef(schema, rootSchema) {
  if (!schema.$ref) return schema;

  // Handle "#/$defs/TypeName" or "#/definitions/TypeName"
  const refPath = schema.$ref;
  if (refPath.startsWith("#/")) {
    const pathParts = refPath.slice(2).split("/");
    let resolved = rootSchema;
    for (const part of pathParts) {
      resolved = resolved[part];
    }
    return resolveRef(resolved, rootSchema);  // Recursive
  }
}
```

**Handles**:
- Local refs: `#/$defs/TypeName`
- Nested refs: Multiple levels of $ref

### Composite Schema Resolution (`schema-utils.ts:55-100`)

Handles complex JSON Schema constructs:

| Construct | Resolution Strategy |
|-----------|---------------------|
| `anyOf` | Pick first non-null type |
| `oneOf` | Pick first non-null type |
| `allOf` | Merge all schemas |

### Form State Initialization (`useSchemaUI.ts:68-90`)

```typescript
useEffect(() => {
  if (!parsedSchema.rawSchema) return;

  const initialState: FormState = {};
  const allFields = [...requiredFields, ...optionalFields];

  for (const field of allFields) {
    const defaultValue = getDefaultValue(field.schema, rawSchema);
    if (defaultValue !== undefined) {
      initialState[field.name] = defaultValue;
    }
  }
  setFormState(initialState);
}, [parsedSchema]);
```

**Default values by type**:
| Type | Default |
|------|---------|
| string | `""` |
| number/integer | `undefined` |
| boolean | `false` |
| array | `[]` |
| object | `{}` |
| enum | First enum value |

### Validation (`schema-utils.ts:307-318`)

```typescript
function validateFormState(formState, requiredFields) {
  for (const field of requiredFields) {
    if (isFieldEmpty(formState[field.name])) {
      return false;
    }
  }
  return true;
}
```

Empty checks:
- `null` / `undefined` → empty
- Empty string / whitespace → empty
- Empty array `[]` → empty
- Empty object `{}` → empty

## Potential Issues

### MEDIUM: No Complex Validation

**Location**: `schema-utils.ts:307-318`

**Current**: Only checks if required fields are non-empty

**Missing**:
- `minLength` / `maxLength`
- `minimum` / `maximum`
- `pattern` (regex)
- `format` (email, uri, etc.)
- Nested object validation

**Impact**: Invalid data can be submitted to LangGraph

### MEDIUM: Limited Type Support

**Location**: `SchemaField.tsx`

**Current Supported Types**:
- string (textarea/input)
- number/integer (input)
- boolean (checkbox/switch)
- enum (select dropdown)
- array of strings (tag input)

**Missing**:
- Nested objects
- Array of objects
- `oneOf` / `anyOf` with multiple distinct types
- Conditional schemas (`if`/`then`/`else`)

### LOW: Re-initialization on Schema Change

**Location**: `useSchemaUI.ts:68-90`

```typescript
useEffect(() => {
  // Re-initializes ALL fields when schema changes
  setFormState(initialState);
}, [parsedSchema]);
```

**Problem**: If assistant changes, all form state is reset, potentially losing user input if they were mid-edit.

**Impact**: Minor UX issue

### LOW: Korean Hardcoded Text

**Location**: `UnifiedInputArea.tsx:89, 158, 162`

```typescript
placeholder = "메시지를 입력하세요..."
<span>실행 중...</span>
<span className="text-xs">입력 폼</span>
```

**Problem**: Korean text not internationalized

## Refactoring Opportunities

### 1. Add JSON Schema Validation Library

**Current**: Manual basic validation

**Proposed**: Use `ajv` for full JSON Schema validation:
```typescript
import Ajv from "ajv";

const ajv = new Ajv();
const validate = ajv.compile(inputSchema);

function validateFormState(formState) {
  return validate(formState);
}
```

**Benefits**:
- Full JSON Schema support
- Clear error messages
- Standard compliance

### 2. Support Nested Objects with Form Builders

**Current**: Flat field rendering only

**Proposed**: Recursive field rendering:
```typescript
function SchemaField({ field, path, ...props }) {
  if (getFieldType(field) === "object") {
    return (
      <fieldset>
        {Object.entries(field.properties).map(([key, subField]) => (
          <SchemaField
            key={key}
            field={subField}
            path={`${path}.${key}`}
            {...props}
          />
        ))}
      </fieldset>
    );
  }
  // ...existing field types
}
```

### 3. Form State Persistence

**Current**: State lost on assistant change

**Proposed**: Persist draft form state:
```typescript
const STORAGE_KEY = `schema-form-${assistantId}`;

function useSchemaUI() {
  // Load from storage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setFormState(JSON.parse(saved));
  }, [assistantId]);

  // Save on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formState));
  }, [formState, assistantId]);
}
```

### 4. Extract Form State Hook

**Current**: Form state mixed with schema parsing in `useSchemaUI`

**Proposed**: Separate concerns:
```typescript
// Schema parsing only
function useParsedSchema() {
  const { schemas } = useAssistantConfig();
  return useMemo(() => parseInputSchema(schemas?.input_schema), [...]);
}

// Form state only
function useSchemaForm(parsedSchema) {
  const [formState, setFormState] = useState({});
  // ...validation, submit payload
}
```

### 5. Component Library Integration

**Current**: Custom field components

**Proposed**: Use shadcn/ui form components with react-hook-form:
```typescript
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { jsonSchemaToZod } from "json-schema-to-zod";

function SchemaForm({ schema }) {
  const zodSchema = jsonSchemaToZod(schema);
  const form = useForm({ resolver: zodResolver(zodSchema) });
  // ...
}
```

**Benefits**:
- Consistent UI
- Better validation UX
- Accessibility

## Summary

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| MEDIUM | No schema validation | Medium | Data integrity |
| MEDIUM | Limited type support | Large | Feature gap |
| LOW | State reset on schema change | Small | UX |
| LOW | Hardcoded Korean text | Small | Internationalization |
