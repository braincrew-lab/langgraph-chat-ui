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

interface StreamErrorMessageProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}

/**
 * Extract error message from various error formats
 */
function getErrorMessage(error: unknown): string {
  if (!error) return "알 수 없는 오류가 발생했습니다.";

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    if (typeof err.message === "string") return err.message;
    if (typeof err.error === "string") return err.error;
    if (typeof err.statusText === "string") return err.statusText;
  }

  return "알 수 없는 오류가 발생했습니다.";
}

/**
 * Get user-friendly error description based on error type
 */
function getErrorDescription(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("network") || message.includes("fetch")) {
    return "네트워크 연결을 확인해주세요.";
  }

  if (message.includes("401") || message.includes("unauthorized")) {
    return "인증이 필요합니다. 다시 로그인해주세요.";
  }

  if (message.includes("403") || message.includes("forbidden")) {
    return "접근 권한이 없습니다.";
  }

  if (message.includes("404") || message.includes("not found")) {
    return "요청한 리소스를 찾을 수 없습니다.";
  }

  if (message.includes("429") || message.includes("rate limit")) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }

  if (message.includes("500") || message.includes("internal server")) {
    return "서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";
  }

  if (message.includes("timeout")) {
    return "요청 시간이 초과되었습니다. 다시 시도해주세요.";
  }

  return "요청을 처리하는 중 문제가 발생했습니다.";
}

export function StreamErrorMessage({
  error,
  onRetry,
  className,
}: StreamErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const errorMessage = getErrorMessage(error);
  const errorDescription = getErrorDescription(error);

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
            오류가 발생했습니다
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
                다시 시도
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
              상세 정보
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
