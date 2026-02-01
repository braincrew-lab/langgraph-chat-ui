import { useCallback } from "react";
import { Input } from "@/shared/components/ui/input";
import { cn } from "@/lib/utils";
import type { NumberFieldProps } from "./types";

export function NumberField({
  field,
  fieldType,
  value,
  onChange,
  disabled,
  compact,
}: NumberFieldProps) {
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
