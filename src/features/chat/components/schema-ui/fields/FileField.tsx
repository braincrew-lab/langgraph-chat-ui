import { useCallback, useRef } from "react";
import { Button } from "@/shared/components/ui/button";
import { Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileFieldProps } from "./types";

export function FileField({
  field,
  value,
  onChange,
  disabled,
  compact,
}: FileFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        // Store the file name as the value
        // In a real implementation, you might want to upload and get a URL/path
        onChange(file.name);
      }
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onChange]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        id={`file-${field.name}`}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className={cn("flex-1 justify-start", compact && "h-8 text-sm")}
      >
        <Upload className="mr-2 h-4 w-4" />
        {value ? (
          <span className="truncate">{value}</span>
        ) : (
          <span className="text-muted-foreground">파일 선택...</span>
        )}
      </Button>
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={disabled}
          className="h-8 w-8 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
