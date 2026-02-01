import { useCallback, useMemo, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { File, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileArrayFieldProps } from "./types";

export function FileArrayField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: FileArrayFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo((): string[] => (Array.isArray(value) ? value : []), [value]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        const newFileNames = Array.from(files).map((f) => f.name);
        onChange([...items, ...newFileNames]);
      }
      // Reset input for re-selection
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [items, onChange]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange]
  );

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-3",
          "min-h-[80px] max-h-[120px] overflow-y-auto",
          "hover:border-primary/50 hover:bg-muted/30 transition-colors",
          items.length === 0 && "flex items-center justify-center",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {items.length === 0 ? (
          <span className="text-muted-foreground text-sm">
            클릭하여 파일 선택...
          </span>
        ) : (
          <div className="space-y-1">
            {items.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 rounded-md border bg-background px-3 py-1.5",
                  compact && "py-1"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={cn("flex-1 truncate text-sm", compact && "text-xs")}>
                  {item}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemove(index)}
                  disabled={disabled}
                  className="h-6 w-6 shrink-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
        multiple
        className="hidden"
        id={`files-${field.name}`}
      />
    </div>
  );
}
