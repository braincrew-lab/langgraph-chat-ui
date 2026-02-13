/**
 * Action Bar Component
 * Bottom action area with:
 * - Left: settings controls (tool toggle, compact view, graph selector)
 * - Right: file upload (chat mode only) + submit button
 * Spans 100% width at the bottom of the input area
 */

import React, { ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Send, LoaderCircle, ArrowUp, Paperclip, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { AssistantSelector } from "../input/AssistantSelector";
import type { Assistant } from "@/app/actions/assistant";

interface ActionBarProps {
  isFormMode: boolean;
  isLoading: boolean;
  disabled: boolean;
  onStop?: () => void;

  // Chat mode only
  enableFileUpload?: boolean;
  onFileUpload?: (e: ChangeEvent<HTMLInputElement>) => void;

  // Settings controls
  compactView: boolean;
  onCompactViewChange: (value: boolean) => void;

  // Assistant selector
  assistants: Assistant[];
  selectedAssistantId: string;
  assistantsLoading: boolean;
  onAssistantChange: (value: string) => void;
  onRefreshAssistants: () => void;
  enableGraphSelection?: boolean;
}

export function ActionBar({
  isFormMode,
  isLoading,
  disabled,
  onStop,
  enableFileUpload = false,
  onFileUpload,
  compactView,
  onCompactViewChange,
  assistants,
  selectedAssistantId,
  assistantsLoading,
  onAssistantChange,
  onRefreshAssistants,
  enableGraphSelection = true,
}: ActionBarProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center justify-between gap-2 px-3 pt-2 pb-3">
      {/* Left: Settings controls */}
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onCompactViewChange(!compactView)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                  compactView
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground hover:bg-accent",
                )}
              >
                <Layers className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>
                {compactView ? t("form.normalView") : t("form.compactView")}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {enableGraphSelection && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <AssistantSelector
                  assistants={assistants}
                  selectedAssistantId={selectedAssistantId}
                  isLoading={assistantsLoading}
                  onSelect={onAssistantChange}
                  onRefresh={onRefreshAssistants}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{t("assistant.selectGraph")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Right: File upload (chat mode) + Submit button */}
      <div className="flex items-center gap-2">
        {!isFormMode && enableFileUpload && onFileUpload && (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Label
                    htmlFor="file-input"
                    className="hover:bg-accent flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg transition-colors"
                  >
                    <Paperclip className="text-muted-foreground h-4 w-4" />
                  </Label>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Upload files</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <input
              id="file-input"
              type="file"
              onChange={onFileUpload}
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              className="hidden"
            />
          </>
        )}

        {/* Submit button - style varies by mode */}
        {isFormMode ? (
          isLoading && onStop ? (
            // Form mode: Stop button during streaming
            <Button
              type="button"
              variant="outline"
              onClick={onStop}
            >
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              {t("form.stop")}
            </Button>
          ) : (
            // Form mode: Submit button
            <Button
              type="submit"
              disabled={disabled}
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  {t("form.processing")}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {t("form.run")}
                </>
              )}
            </Button>
          )
        ) : isLoading ? (
          <Button
            key="stop"
            onClick={onStop}
            size="icon"
            variant="outline"
            className="h-8 w-8"
          >
            <LoaderCircle className="h-4 w-4 animate-spin" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 rounded-lg"
            disabled={disabled}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
