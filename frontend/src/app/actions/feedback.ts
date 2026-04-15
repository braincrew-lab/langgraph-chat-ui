"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";
import {
  createFeedback as createFeedbackService,
  getFeedbacks,
  getFeedbackStats,
  updateFeedbackStatus as updateFeedbackStatusService,
  deleteFeedback as deleteFeedbackService,
  getUserFeedbacksForThread as getUserFeedbacksForThreadService,
} from "@/lib/services/feedback.service";
import type { FeedbackListParams } from "@/lib/services/feedback.service";
import {
  getActiveRubricItems as getActiveRubricItemsService,
  getRubricItems as getRubricItemsService,
  createRubricItem as createRubricItemService,
  updateRubricItem as updateRubricItemService,
  deactivateRubricItem as deactivateRubricItemService,
  reorderRubricItems as reorderRubricItemsService,
} from "@/lib/services/rubric.service";

// =============================================================================
// Types
// =============================================================================

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// =============================================================================
// Auth Helpers
// =============================================================================

async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  if (!isAdmin(session.user.role as UserRole)) {
    throw new Error("Forbidden");
  }
  return session;
}

// =============================================================================
// User Actions (authenticated users)
// =============================================================================

export async function submitFeedback(data: {
  threadId: string;
  checkpointId?: string;
  messageId?: string;
  comment?: string;
  scores: Array<{ rubricItemId: string; score: number }>;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireAuth();
    const result = await createFeedbackService({
      ...data,
      userId: session.user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit feedback",
    };
  }
}

export async function getUserThreadFeedbacks(
  threadId: string,
): Promise<
  ActionResult<
    Array<{
      id: string;
      messageId: string | null;
      comment: string | null;
      scores: Array<{ rubricItemId: string; score: number }>;
    }>
  >
> {
  try {
    const session = await requireAuth();
    const feedbacks = await getUserFeedbacksForThreadService(
      session.user.id,
      threadId,
    );
    return { success: true, data: feedbacks };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get thread feedbacks",
    };
  }
}

export async function getActiveFeedbackRubricItems(): Promise<
  ActionResult<
    Array<{
      id: string;
      name: string;
      description: string | null;
      order: number;
    }>
  >
> {
  try {
    await requireAuth();
    const items = await getActiveRubricItemsService();
    return { success: true, data: items };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get rubric items",
    };
  }
}

// =============================================================================
// Admin Actions
// =============================================================================

export async function getAdminFeedbacks(
  filters?: FeedbackListParams,
): Promise<ActionResult<ReturnType<typeof getFeedbacks> extends Promise<infer T> ? T : never>> {
  try {
    await requireAdmin();
    const result = await getFeedbacks(filters);

    // Serialize dates
    const serialized = {
      ...result,
      feedbacks: result.feedbacks.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString() as unknown as Date,
        updatedAt: f.updatedAt.toISOString() as unknown as Date,
        reviewedAt: f.reviewedAt?.toISOString() as unknown as Date | null,
      })),
    };

    return { success: true, data: serialized };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get feedbacks",
    };
  }
}

export async function getAdminFeedbackStats(): Promise<
  ActionResult<Awaited<ReturnType<typeof getFeedbackStats>>>
> {
  try {
    await requireAdmin();
    const stats = await getFeedbackStats();
    return { success: true, data: stats };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get feedback stats",
    };
  }
}

export async function updateFeedbackStatusAction(
  feedbackId: string,
  status: string,
  adminNote?: string,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await updateFeedbackStatusService(
      feedbackId,
      status,
      session.user.id,
      adminNote,
    );

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    revalidatePath("/admin/feedback");
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

export async function deleteFeedbackAction(
  feedbackId: string,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await deleteFeedbackService(feedbackId, session.user.id);

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete feedback",
    };
  }
}

// =============================================================================
// Rubric Admin Actions
// =============================================================================

export async function getRubricItemsAction(
  includeInactive = true,
): Promise<ActionResult<Awaited<ReturnType<typeof getRubricItemsService>>>> {
  try {
    await requireAdmin();
    const items = await getRubricItemsService(includeInactive);
    return { success: true, data: items };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get rubric items",
    };
  }
}

export async function createRubricItemAction(data: {
  name: string;
  description?: string;
  order?: number;
}): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await createRubricItemService(data, session.user.id);

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to create rubric item",
    };
  }
}

export async function updateRubricItemAction(
  id: string,
  data: { name?: string; description?: string; order?: number; isActive?: boolean },
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await updateRubricItemService(id, data, session.user.id);

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to update rubric item",
    };
  }
}

export async function deleteRubricItemAction(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await deactivateRubricItemService(id, session.user.id);

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to deactivate rubric item",
    };
  }
}

export async function reorderRubricItemsAction(
  items: Array<{ id: string; order: number }>,
): Promise<ActionResult> {
  try {
    const session = await requireAdmin();
    const result = await reorderRubricItemsService(items, session.user.id);

    if (!result.success) {
      return { success: false, error: result.error! };
    }

    revalidatePath("/admin/feedback");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to reorder rubric items",
    };
  }
}
