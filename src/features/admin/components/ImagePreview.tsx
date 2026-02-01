"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { ImageIcon, AlertCircle, Upload, Loader2, RotateCcw } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { toast } from "sonner";

interface ImagePreviewProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultValue?: string;
}

export function ImagePreview({
  value,
  onChange,
  placeholder = "이미지 URL 입력 또는 파일 업로드...",
  defaultValue = "",
}: ImagePreviewProps) {
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/x-icon"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("지원하지 않는 파일 형식입니다. (JPEG, PNG, GIF, WEBP, SVG, ICO)");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("파일 크기는 2MB 이하여야 합니다.");
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
        throw new Error(data.error || "업로드 실패");
      }

      const data = await response.json();
      handleChange(data.url);
      toast.success("이미지가 업로드되었습니다.");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
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
          placeholder={placeholder}
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
              <p>기본값으로 초기화</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Preview thumbnail */}
        {value && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="h-9 w-9 shrink-0 rounded-md border border-input bg-background flex items-center justify-center overflow-hidden">
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
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-0 bg-background border">
              {showPreview ? (
                <div className="p-2">
                  <Image
                    src={value}
                    alt="Preview"
                    width={128}
                    height={128}
                    className="max-w-[128px] max-h-[128px] object-contain"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="p-2 text-sm text-destructive">
                  이미지를 로드할 수 없습니다
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">
          이미지를 로드할 수 없습니다. URL을 확인해주세요.
        </p>
      )}
    </div>
  );
}
