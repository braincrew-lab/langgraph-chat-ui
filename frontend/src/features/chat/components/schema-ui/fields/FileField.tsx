import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/shared/components/ui/button";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  processFileForField,
  extractDisplayName,
} from "@/lib/utils/file-upload";
import { TruncatedFileName } from "./TruncatedFileName";
import type { FileFieldProps } from "./types";

export function FileField({
  field,
  value,
  displayValue,
  onChange,
  onDisplayValueChange,
  disabled,
  compact,
  fileUploadMode = "base64",
}: FileFieldProps) {
  const t = useTranslations("chat");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [displayName, setDisplayName] = useState(
    () => displayValue || extractDisplayName(value),
  );

  useEffect(() => {
    setDisplayName(displayValue || extractDisplayName(value));
  }, [displayValue, value]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
        const result = await processFileForField(file, fileUploadMode);
        onChange(result);
        onDisplayValueChange?.(file.name);
        setDisplayName(file.name);
      } catch (err) {
        toast.error(
          t("form.uploadFailed", {
            fallback: err instanceof Error ? err.message : "Upload failed",
          }),
        );
      } finally {
        setIsUploading(false);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [onChange, fileUploadMode, t],
  );

  const handleClear = useCallback(() => {
    onChange("");
    onDisplayValueChange?.("");
    setDisplayName("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, [onChange, onDisplayValueChange]);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
        className="hidden"
        id={`file-${field.name}`}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? "sm" : "default"}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isUploading}
        className={cn("flex-1 justify-start", compact && "h-8 text-sm")}
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-muted-foreground">
              {t("form.uploading", { fallback: "Uploading..." })}
            </span>
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            {value ? (
              <TruncatedFileName name={displayName} />
            ) : (
              <span className="text-muted-foreground">
                {t("form.selectFile")}...
              </span>
            )}
          </>
        )}
      </Button>
      {value && !isUploading && (
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
