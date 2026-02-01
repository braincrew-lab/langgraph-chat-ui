import { cn } from "@/lib/utils";
import type { EnumFieldProps } from "./types";

export function EnumField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: EnumFieldProps) {
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
