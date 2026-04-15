"use client";

import { useState, useEffect } from "react";
import { MessageSquareHeart } from "lucide-react";
import { TooltipIconButton } from "../TooltipIconButton";
import { FeedbackDialog } from "./FeedbackDialog";
import { useTranslations } from "next-intl";
import { getActiveFeedbackRubricItems } from "@/app/actions/feedback";

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

interface FeedbackButtonProps {
  threadId: string | null;
  checkpointId?: string | null;
  messageId?: string;
  isLoading: boolean;
  existingFeedback?: ExistingFeedback | null;
}

// Module-level cache: fetch once, share across all FeedbackButton instances
let rubricCache: RubricItem[] | null = null;
let rubricPromise: Promise<RubricItem[]> | null = null;

function getRubricItems(): Promise<RubricItem[]> {
  if (rubricCache) return Promise.resolve(rubricCache);
  if (rubricPromise) return rubricPromise;
  rubricPromise = getActiveFeedbackRubricItems().then((result) => {
    const items = result.success && result.data ? result.data : [];
    rubricCache = items;
    return items;
  });
  return rubricPromise;
}

export function FeedbackButton({
  threadId,
  checkpointId,
  messageId,
  isLoading,
  existingFeedback,
}: FeedbackButtonProps) {
  const t = useTranslations("chat");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(!!existingFeedback);
  const [rubricItems, setRubricItems] = useState<RubricItem[]>(
    rubricCache ?? [],
  );

  // Eagerly prefetch rubric items on mount
  useEffect(() => {
    getRubricItems().then(setRubricItems);
  }, []);

  if (!threadId || rubricItems.length === 0) return null;

  return (
    <>
      <TooltipIconButton
        disabled={isLoading}
        tooltip={t("feedback.title")}
        variant="ghost"
        className={
          hasSubmitted
            ? "text-primary hover:text-primary/80"
            : "text-muted-foreground/40 hover:text-muted-foreground"
        }
        onClick={() => setDialogOpen(true)}
      >
        <MessageSquareHeart />
      </TooltipIconButton>

      <FeedbackDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        threadId={threadId}
        checkpointId={checkpointId}
        messageId={messageId}
        rubricItems={rubricItems}
        existingFeedback={existingFeedback}
        onSubmitted={() => setHasSubmitted(true)}
      />
    </>
  );
}
