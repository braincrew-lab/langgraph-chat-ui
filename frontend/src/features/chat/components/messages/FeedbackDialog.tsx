"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import { submitFeedback } from "@/app/actions/feedback";

interface RubricItem {
  id: string;
  name: string;
  description: string | null;
  order: number;
}

interface ExistingFeedback {
  id: string;
  comment: string | null;
  scores: Array<{ rubricItemId: string; score: number }>;
}

interface FeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  checkpointId?: string | null;
  messageId?: string;
  rubricItems: RubricItem[];
  existingFeedback?: ExistingFeedback | null;
  onSubmitted?: (scores: Array<{ rubricItemId: string; score: number }>) => void;
}

function Star({ filled, half }: { filled: boolean; half?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {half ? (
        <>
          <defs>
            <clipPath id="half-left">
              <rect x="0" y="0" width="12" height="24" />
            </clipPath>
            <clipPath id="half-right">
              <rect x="12" y="0" width="12" height="24" />
            </clipPath>
          </defs>
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            className="fill-primary"
            clipPath="url(#half-left)"
          />
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            className="fill-muted stroke-muted-foreground/20"
            strokeWidth="0.5"
            clipPath="url(#half-right)"
          />
        </>
      ) : (
        <path
          d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
          className={
            filled
              ? "fill-primary transition-colors"
              : "fill-muted stroke-muted-foreground/20 transition-colors"
          }
          strokeWidth={filled ? "0" : "0.5"}
        />
      )}
    </svg>
  );
}

function ScoreSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (score: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div
      className="flex w-full max-w-[200px] gap-1"
      onMouseLeave={() => setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          onClick={() => onChange(score)}
          onMouseEnter={() => setHovered(score)}
          className="h-7 w-7 cursor-pointer transition-transform hover:scale-110"
        >
          <Star filled={score <= display} />
        </button>
      ))}
    </div>
  );
}

export function FeedbackDialog({
  open,
  onOpenChange,
  threadId,
  checkpointId,
  messageId,
  rubricItems,
  existingFeedback,
  onSubmitted,
}: FeedbackDialogProps) {
  const t = useTranslations("chat");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");

  // Initialize scores when dialog opens
  useEffect(() => {
    if (open) {
      if (existingFeedback) {
        const scoreMap: Record<string, number> = {};
        for (const s of existingFeedback.scores) {
          scoreMap[s.rubricItemId] = s.score;
        }
        setScores(scoreMap);
        setComment(existingFeedback.comment || "");
      } else {
        const initialScores: Record<string, number> = {};
        for (const item of rubricItems) {
          initialScores[item.id] = 0;
        }
        setScores(initialScores);
        setComment("");
      }
    }
  }, [open, existingFeedback, rubricItems]);

  const handleSubmit = () => {
    const scoreEntries: Array<{ rubricItemId: string; score: number }> = [];
    for (const [rubricItemId, score] of Object.entries(scores) as [string, number][]) {
      if (score > 0) {
        scoreEntries.push({ rubricItemId, score });
      }
    }

    if (scoreEntries.length === 0) return;

    startTransition(async () => {
      const result = await submitFeedback({
        threadId,
        checkpointId: checkpointId ?? undefined,
        messageId,
        comment: comment.trim() || undefined,
        scores: scoreEntries,
      });

      if (result.success) {
        onSubmitted?.(scoreEntries);
        onOpenChange(false);
      } else {
        alert(result.error);
      }
    });
  };

  const allScored =
    rubricItems.length > 0 &&
    rubricItems.every((item) => scores[item.id] > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{t("feedback.title")}</DialogTitle>
          <DialogDescription>{t("feedback.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1">
          {rubricItems.map((item) => (
            <div key={item.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{item.name}</label>
                {scores[item.id] > 0 && (
                  <span className="text-muted-foreground text-xs">
                    {t("feedback.score", { score: scores[item.id] })}
                  </span>
                )}
              </div>
              {item.description && (
                <p className="text-muted-foreground text-xs">
                  {item.description}
                </p>
              )}
              <ScoreSelector
                value={scores[item.id] || 0}
                onChange={(score) =>
                  setScores((prev) => ({ ...prev, [item.id]: score }))
                }
              />
            </div>
          ))}

          <div className="space-y-1.5 pt-2">
            <label className="text-sm font-medium">
              {t("feedback.comment")}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("feedback.commentPlaceholder")}
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !allScored}
          >
            {isPending ? t("feedback.submitting") : t("feedback.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
