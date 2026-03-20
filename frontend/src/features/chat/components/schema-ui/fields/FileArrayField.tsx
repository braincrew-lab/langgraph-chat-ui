import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { File as FileIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  processFileForField,
  extractDisplayName,
} from "@/lib/utils/file-upload";
import { TruncatedFileName } from "./TruncatedFileName";
import type { FileArrayFieldProps } from "./types";

export function FileArrayField({
  field,
  value,
  onChange,
  disabled,
  compact,
  fileUploadMode = "base64",
}: FileArrayFieldProps) {
  const t = useTranslations("chat");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [displayNames, setDisplayNames] = useState<string[]>(() =>
    (Array.isArray(value) ? value : []).map(extractDisplayName),
  );

  const items = useMemo(
    (): string[] => (Array.isArray(value) ? value : []),
    [value],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setIsUploading(true);
      try {
        const fileArray = Array.from(files);
        const results = await Promise.all(
          fileArray.map((f) => processFileForField(f, fileUploadMode)),
        );
        const newNames = fileArray.map((f) => f.name);
        onChange([...items, ...results]);
        setDisplayNames((prev) => [...prev, ...newNames]);
      } catch (err) {
        toast.error(
          t("form.uploadFailed", {
            fallback:
              err instanceof Error ? err.message : "Upload failed",
          }),
        );
      } finally {
        setIsUploading(false);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [items, onChange, fileUploadMode, t],
  );

  const handleRemove = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
      setDisplayNames((prev) => prev.filter((_, i) => i !== index));
    },
    [items, onChange],
  );

  return (
    <div className="space-y-2">
      <div
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-3",
          "max-h-[120px] min-h-[80px] overflow-y-auto overflow-x-hidden",
          "hover:border-primary/50 hover:bg-muted/30 transition-colors",
          items.length === 0 && !isUploading && "flex items-center justify-center",
          (disabled || isUploading) && "cursor-not-allowed opacity-50",
        )}
      >
        {isUploading ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-muted-foreground text-sm">
              {t("form.uploading", { fallback: "Uploading..." })}
            </span>
          </div>
        ) : items.length === 0 ? (
          <span className="text-muted-foreground text-sm">
            {t("form.clickToSelect")}
          </span>
        ) : (
          <div className="space-y-1">
            {items.map((_, index) => (
              <div
                key={index}
                className={cn(
                  "bg-background flex min-w-0 items-center gap-2 overflow-hidden rounded-md border px-3 py-1.5",
                  compact && "py-1",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <FileIcon className="text-muted-foreground h-4 w-4 shrink-0" />
                <TruncatedFileName
                  name={displayNames[index] || extractDisplayName(items[index])}
                  className={cn(
                    "min-w-0 flex-1 text-sm",
                    compact && "text-xs",
                  )}
                />
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
        disabled={disabled || isUploading}
        multiple
        className="hidden"
        id={`files-${field.name}`}
      />
    </div>
  );
}
