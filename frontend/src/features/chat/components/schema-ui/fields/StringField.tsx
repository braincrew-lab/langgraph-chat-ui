import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { StringFieldProps } from "./types";

export function StringField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: StringFieldProps) {
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
