import { Switch } from "@/shared/components/ui/switch";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/lib/utils";
import type { BooleanFieldProps } from "./types";

export function BooleanField({
  field,
  value,
  onChange,
  disabled,
  label,
  compact,
}: BooleanFieldProps) {
  return (
    <div className={cn("flex items-center gap-2", compact && "gap-1.5")}>
      <Switch
        checked={value ?? false}
        onCheckedChange={(checked) => onChange(checked)}
        disabled={disabled}
      />
      <Label
        className={cn(
          "cursor-pointer text-sm font-medium",
          field.isRequired &&
            "after:ml-0.5 after:text-red-500 after:content-['*']",
        )}
      >
        {label}
      </Label>
    </div>
  );
}
