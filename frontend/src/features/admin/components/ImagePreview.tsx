"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  ImageIcon,
  AlertCircle,
  Upload,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ImagePreviewProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultValue?: string;
}

export function ImagePreview({
  value,
  onChange,
  placeholder,
  defaultValue = "",
}: ImagePreviewProps) {
  const t = useTranslations('admin');
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resolvedPlaceholder = placeholder || t('imagePreview.placeholder');

  const handleChange = (newValue: string) => {
    setError(false);
    onChange(newValue);
  };

  const handleImageError = () => {
    setError(true);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    setError(false);
    onChange(defaultValue);
  };

  const canReset = value !== defaultValue;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input
    e.target.value = "";

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('imagePreview.unsupportedFormat'));
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('imagePreview.fileTooLarge'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('imagePreview.uploadFailed'));
      }

      const data = await response.json();
      handleChange(data.url);
      toast.success(t('imagePreview.uploadSuccess'));
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(
        err instanceof Error ? err.message : t('imagePreview.uploadError'),
      );
    } finally {
      setUploading(false);
    }
  };

  const showPreview = value && !error;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          className="flex-1"
        />

        {/* Upload button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/x-icon"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>

        {/* Reset button */}
        {canReset && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleReset}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{t('imagePreview.resetToDefault')}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Preview thumbnail */}
        {value && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="border-input bg-background flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {showPreview ? (
                  <Image
                    src={value}
                    alt="Preview"
                    width={36}
                    height={36}
                    className="h-full w-full object-contain"
                    onError={handleImageError}
                    unoptimized
                  />
                ) : error ? (
                  <AlertCircle className="text-destructive h-4 w-4" />
                ) : (
                  <ImageIcon className="text-muted-foreground h-4 w-4" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="bg-background border p-0"
            >
              {showPreview ? (
                <div className="p-2">
                  <Image
                    src={value}
                    alt="Preview"
                    width={128}
                    height={128}
                    className="max-h-[128px] max-w-[128px] object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="text-destructive p-2 text-sm">
                  {t('imagePreview.cannotLoad')}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {error && (
        <p className="text-destructive text-xs">
          {t('imagePreview.cannotLoadCheck')}
        </p>
      )}
    </div>
  );
}
