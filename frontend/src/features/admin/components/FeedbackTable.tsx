"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, CheckCircle2, Eye, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  updateFeedbackStatusAction,
  deleteFeedbackAction,
} from "@/app/actions/feedback";

interface FeedbackItem {
  id: string;
  threadId: string;
  checkpointId: string | null;
  messageId: string | null;
  comment: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string | null; email: string };
  reviewedBy: { name: string | null; email: string } | null;
  scores: Array<{
    id: string;
    score: number;
    rubricItem: { id: string; name: string };
  }>;
}

interface FeedbackTableProps {
  feedbacks: FeedbackItem[];
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("admin");
  const label =
    status === "new"
      ? t("feedback.table.new")
      : status === "reviewed"
        ? t("feedback.table.reviewed")
        : t("feedback.table.resolved");

  if (status === "reviewed") return <Badge variant="secondary">{label}</Badge>;
  if (status === "resolved") return <Badge variant="outline">{label}</Badge>;
  return <Badge>{label}</Badge>;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`h-2 w-2 rounded-full ${
            i <= score ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
      <span className="text-muted-foreground ml-1 text-xs">{score}</span>
    </div>
  );
}

export function FeedbackTable({ feedbacks }: FeedbackTableProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<FeedbackItem | null>(null);

  const handleAction = async (
    feedbackId: string,
    action: () => Promise<{ success: boolean; error?: string }>,
  ) => {
    setLoadingId(feedbackId);
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        alert(result.error || "Action failed");
      }
      setLoadingId(null);
      router.refresh();
    });
  };

  // Collect unique rubric item names from all feedbacks
  const rubricNames = Array.from(
    new Set(
      feedbacks.flatMap((f) => f.scores.map((s) => s.rubricItem.name)),
    ),
  );

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">
                {t("feedback.table.user")}
              </TableHead>
              {rubricNames.map((name) => (
                <TableHead key={name} className="w-[100px] text-center">
                  {name}
                </TableHead>
              ))}
              <TableHead className="w-[60px] text-center">
                {t("feedback.table.average")}
              </TableHead>
              <TableHead className="min-w-[150px]">
                {t("feedback.table.comment")}
              </TableHead>
              <TableHead className="w-[90px]">
                {t("feedback.table.status")}
              </TableHead>
              <TableHead className="w-[100px]">
                {t("feedback.table.date")}
              </TableHead>
              <TableHead className="w-[50px]">
                {t("feedback.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {feedbacks.map((feedback) => {
              const scoreMap = new Map(
                feedback.scores.map((s) => [s.rubricItem.name, s.score]),
              );
              const avgScore =
                feedback.scores.length > 0
                  ? (
                      feedback.scores.reduce((sum, s) => sum + s.score, 0) /
                      feedback.scores.length
                    ).toFixed(1)
                  : "—";

              return (
                <TableRow
                  key={feedback.id}
                  className={
                    isPending && loadingId === feedback.id ? "opacity-50" : ""
                  }
                >
                  <TableCell>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {feedback.user.name || feedback.user.email}
                      </p>
                      {feedback.user.name && (
                        <p className="text-muted-foreground truncate text-xs">
                          {feedback.user.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  {rubricNames.map((name) => {
                    const score = scoreMap.get(name);
                    return (
                      <TableCell key={name} className="text-center">
                        {score ? <ScoreBar score={score} /> : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <span className="font-semibold">{avgScore}</span>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-[200px] truncate text-sm">
                      {feedback.comment || t("feedback.table.noComment")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={feedback.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(feedback.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={isPending && loadingId === feedback.id}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {feedback.status !== "reviewed" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleAction(feedback.id, () =>
                                updateFeedbackStatusAction(
                                  feedback.id,
                                  "reviewed",
                                ),
                              )
                            }
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            {t("feedback.table.markReviewed")}
                          </DropdownMenuItem>
                        )}
                        {feedback.status !== "resolved" && (
                          <DropdownMenuItem
                            onClick={() =>
                              handleAction(feedback.id, () =>
                                updateFeedbackStatusAction(
                                  feedback.id,
                                  "resolved",
                                ),
                              )
                            }
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {t("feedback.table.markResolved")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            router.push(
                              "/?threadId=" + feedback.threadId,
                            )
                          }
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          {t("feedback.table.viewThread")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteDialog(feedback)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("feedback.table.deleteFeedback")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteDialog}
        onOpenChange={(open) => !open && setDeleteDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("feedback.table.deleteFeedback")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("feedback.table.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog) {
                  handleAction(deleteDialog.id, () =>
                    deleteFeedbackAction(deleteDialog.id),
                  );
                  setDeleteDialog(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
