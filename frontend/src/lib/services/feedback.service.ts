import { prisma } from "@/lib/auth/prisma";

export interface FeedbackListParams {
  page?: number;
  pageSize?: number;
  status?: "new" | "reviewed" | "resolved" | "all";
  search?: string;
  sortBy?: "createdAt" | "status";
  sortOrder?: "asc" | "desc";
}

export interface FeedbackListResult {
  feedbacks: Array<{
    id: string;
    threadId: string;
    checkpointId: string | null;
    messageId: string | null;
    comment: string | null;
    status: string;
    adminNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: { id: string; name: string | null; email: string };
    reviewedBy: { name: string | null; email: string } | null;
    reviewedAt: Date | null;
    scores: Array<{
      id: string;
      score: number;
      rubricItem: { id: string; name: string };
    }>;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FeedbackStats {
  total: number;
  new: number;
  reviewed: number;
  resolved: number;
  rubricAverages: Array<{
    rubricItemId: string;
    rubricItemName: string;
    average: number;
    count: number;
  }>;
}

/**
 * Get paginated list of feedbacks with filtering
 */
export async function getFeedbacks(
  params: FeedbackListParams = {},
): Promise<FeedbackListResult> {
  const {
    page = 1,
    pageSize = 20,
    status = "all",
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const where: Record<string, unknown> = {};

  if (status !== "all") {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { comment: { contains: search } },
      { user: { email: { contains: search } } },
      { user: { name: { contains: search } } },
      { threadId: { contains: search } },
    ];
  }

  const [feedbacks, total] = await Promise.all([
    prisma.threadFeedback.findMany({
      where,
      select: {
        id: true,
        threadId: true,
        checkpointId: true,
        messageId: true,
        comment: true,
        status: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        reviewedAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { name: true, email: true },
        },
        scores: {
          select: {
            id: true,
            score: true,
            rubricItem: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.threadFeedback.count({ where }),
  ]);

  return {
    feedbacks,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get feedback statistics including per-rubric averages
 */
export async function getFeedbackStats(): Promise<FeedbackStats> {
  const [total, newCount, reviewed, resolved, rubricAveragesRaw] =
    await Promise.all([
      prisma.threadFeedback.count(),
      prisma.threadFeedback.count({ where: { status: "new" } }),
      prisma.threadFeedback.count({ where: { status: "reviewed" } }),
      prisma.threadFeedback.count({ where: { status: "resolved" } }),
      prisma.feedbackScore.groupBy({
        by: ["rubricItemId"],
        _avg: { score: true },
        _count: { score: true },
      }),
    ]);

  // Resolve rubric item names
  const rubricItemIds = rubricAveragesRaw.map((r) => r.rubricItemId);
  const rubricItems =
    rubricItemIds.length > 0
      ? await prisma.feedbackRubricItem.findMany({
          where: { id: { in: rubricItemIds } },
          select: { id: true, name: true },
        })
      : [];

  const rubricMap = new Map(rubricItems.map((r) => [r.id, r.name]));

  return {
    total,
    new: newCount,
    reviewed,
    resolved,
    rubricAverages: rubricAveragesRaw.map((r) => ({
      rubricItemId: r.rubricItemId,
      rubricItemName: rubricMap.get(r.rubricItemId) ?? "Unknown",
      average: r._avg.score ?? 0,
      count: r._count.score,
    })),
  };
}

/**
 * Create or update feedback (upsert by userId + messageId)
 */
export async function createFeedback(data: {
  threadId: string;
  checkpointId?: string;
  messageId?: string;
  userId: string;
  comment?: string;
  scores: Array<{ rubricItemId: string; score: number }>;
}): Promise<{ success: boolean; error?: string }> {
  // Validate scores (1-5)
  for (const s of data.scores) {
    if (s.score < 1 || s.score > 5 || !Number.isInteger(s.score)) {
      return { success: false, error: "Score must be an integer between 1 and 5" };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Upsert: find existing by userId + messageId
      let feedbackId: string;

      if (data.messageId) {
        const existing = await tx.threadFeedback.findUnique({
          where: {
            userId_messageId: {
              userId: data.userId,
              messageId: data.messageId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          // Update existing feedback
          await tx.threadFeedback.update({
            where: { id: existing.id },
            data: {
              comment: data.comment,
              status: "new", // Reset status on re-submit
            },
          });
          feedbackId = existing.id;

          // Replace scores
          await tx.feedbackScore.deleteMany({
            where: { feedbackId: existing.id },
          });
        } else {
          const created = await tx.threadFeedback.create({
            data: {
              threadId: data.threadId,
              checkpointId: data.checkpointId,
              messageId: data.messageId,
              userId: data.userId,
              comment: data.comment,
            },
          });
          feedbackId = created.id;
        }
      } else {
        const created = await tx.threadFeedback.create({
          data: {
            threadId: data.threadId,
            checkpointId: data.checkpointId,
            messageId: data.messageId,
            userId: data.userId,
            comment: data.comment,
          },
        });
        feedbackId = created.id;
      }

      // Create scores
      if (data.scores.length > 0) {
        await tx.feedbackScore.createMany({
          data: data.scores.map((s) => ({
            feedbackId,
            rubricItemId: s.rubricItemId,
            score: s.score,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: data.userId,
          action: "feedback.submit",
          target: feedbackId,
          details: JSON.stringify({
            threadId: data.threadId,
            messageId: data.messageId,
            scoreCount: data.scores.length,
          }),
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to submit feedback",
    };
  }
}

/**
 * Update feedback status (admin review)
 */
export async function updateFeedbackStatus(
  id: string,
  status: string,
  reviewedById: string,
  adminNote?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.threadFeedback.findUnique({
        where: { id },
        select: { status: true },
      });

      if (!existing) {
        throw new Error("Feedback not found");
      }

      await tx.threadFeedback.update({
        where: { id },
        data: {
          status,
          reviewedById,
          reviewedAt: new Date(),
          ...(adminNote !== undefined && { adminNote }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: reviewedById,
          action: "feedback.review",
          target: id,
          details: JSON.stringify({
            oldStatus: existing.status,
            newStatus: status,
            adminNote,
          }),
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update feedback status",
    };
  }
}

/**
 * Delete feedback (admin)
 */
export async function deleteFeedback(
  id: string,
  deletedById: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.threadFeedback.findUnique({
        where: { id },
        select: { threadId: true, userId: true },
      });

      if (!existing) {
        throw new Error("Feedback not found");
      }

      await tx.threadFeedback.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: deletedById,
          action: "feedback.delete",
          target: id,
          details: JSON.stringify({
            threadId: existing.threadId,
            feedbackUserId: existing.userId,
          }),
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete feedback",
    };
  }
}

/**
 * Get a user's feedback for a specific message
 */
export async function getUserFeedbackForMessage(
  userId: string,
  messageId: string,
) {
  return prisma.threadFeedback.findUnique({
    where: { userId_messageId: { userId, messageId } },
    select: {
      id: true,
      comment: true,
      scores: {
        select: {
          rubricItemId: true,
          score: true,
        },
      },
    },
  });
}

/**
 * Get all feedbacks by a user for a thread (batch loading for chat UI)
 */
export async function getUserFeedbacksForThread(
  userId: string,
  threadId: string,
) {
  return prisma.threadFeedback.findMany({
    where: { userId, threadId },
    select: {
      id: true,
      messageId: true,
      comment: true,
      scores: {
        select: {
          rubricItemId: true,
          score: true,
        },
      },
    },
  });
}
