import { useCallback, useMemo } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFieldType, getArrayItemSchema } from "@/lib/utils/schema";
import type { ArrayFieldProps } from "./types";

export function ArrayField({
  field,
  rootSchema,
  value,
  onChange,
  disabled,
  compact,
}: ArrayFieldProps) {
  const items = useMemo(
    (): (string | number)[] => (Array.isArray(value) ? value : []),
    [value],
  );
  const itemSchema = getArrayItemSchema(field, rootSchema);
  const itemType = itemSchema ? getFieldType(itemSchema, rootSchema) : "string";

  const handleAdd = useCallback(() => {
    const newValue: string | number =
      itemType === "number" || itemType === "integer" ? 0 : "";
    const newItems: (string | number)[] = [...items, newValue];
    onChange(newItems);
  }, [items, onChange, itemType]);

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange],
  );

  const handleItemChange = useCallback(
    (index: number, newValue: string | number) => {
      const newItems = [...items];
      newItems[index] = newValue;
      onChange(newItems);
    },
    [items, onChange],
  );

  return (
    <div className="mt-2 space-y-2">
      {items.map((item, index) => (
        <div
          key={index}
          className="flex items-center gap-2"
        >
          <Input
            type={
              itemType === "number" || itemType === "integer"
                ? "number"
                : "text"
            }
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            disabled={disabled}
            placeholder={`Item ${index + 1}`}
            className={cn("flex-1", compact && "h-8 text-sm")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(index)}
            disabled={disabled}
            className="h-8 w-8 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled}
        className={cn("w-full", compact && "h-7 text-xs")}
      >
        <Plus className="mr-1 h-3 w-3" />
        Add Item
      </Button>
    </div>
  );
}
