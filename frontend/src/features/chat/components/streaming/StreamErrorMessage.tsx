/**
 * StreamErrorMessage - Inline error message for streaming failures
 *
 * Displays when a server error occurs during streaming,
 * replacing the task view with an error message and retry option.
 */

"use client";

import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useTranslations } from "next-intl";

interface StreamErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/**
 * Extract error message from various error formats
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
    if (typeof err.statusText === "string") return err.statusText;
  }

  return fallback;
}

/**
 * Get user-friendly error description key based on error type
 */
function getErrorDescriptionKey(errorMessage: string): string {
  const message = errorMessage.toLowerCase();

  if (message.includes("network") || message.includes("fetch")) {
    return "networkError";
  }

  if (message.includes("401") || message.includes("unauthorized")) {
    return "authRequired";
  }

  if (message.includes("403") || message.includes("forbidden")) {
    return "forbidden";
  }

  if (message.includes("404") || message.includes("not found")) {
    return "notFound";
  }

  if (message.includes("429") || message.includes("rate limit")) {
    return "tooManyRequests";
  }

  if (message.includes("500") || message.includes("internal server")) {
    return "serverError";
  }

  if (message.includes("timeout")) {
    return "requestTimeout";
  }

  return "processingError";
}

export function StreamErrorMessage({
  error,
  onRetry,
  className,
}: StreamErrorMessageProps) {
  const t = useTranslations("chat");
  const [showDetails, setShowDetails] = useState(false);
  const errorMessage = getErrorMessage(error, t("streaming.error.unknown"));
  const errorDescriptionKey = getErrorDescriptionKey(errorMessage);
  const errorDescription = t(`streaming.error.${errorDescriptionKey}`);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "border-destructive/20 bg-destructive/5 rounded-lg border p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <p className="text-destructive text-sm font-medium">
            {t("streaming.error.title")}
          </p>
          <p className="text-muted-foreground text-sm">{errorDescription}</p>

          <div className="flex items-center gap-2 pt-1">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-8"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("streaming.error.retry")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-muted-foreground h-8"
            >
              <ChevronDown
                className={cn(
                  "mr-1 h-3.5 w-3.5 transition-transform",
                  showDetails && "rotate-180",
                )}
              />
              {t("streaming.error.details")}
            </Button>
          </div>

          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="pt-2"
            >
              <pre className="bg-muted/50 overflow-auto rounded-md p-2 text-xs">
                {errorMessage}
              </pre>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
