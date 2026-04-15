import { prisma } from "@/lib/auth/prisma";

/**
 * Get rubric items, optionally including inactive ones
 */
export async function getRubricItems(includeInactive = false) {
  return prisma.feedbackRubricItem.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      order: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Get only active rubric items (for chat UI)
 */
export async function getActiveRubricItems() {
  return getRubricItems(false);
}

/**
 * Create a new rubric item
 */
export async function createRubricItem(
  data: { name: string; description?: string; order?: number },
  createdById: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      // Auto-assign order if not provided
      let order = data.order;
      if (order === undefined) {
        const maxOrder = await tx.feedbackRubricItem.aggregate({
          _max: { order: true },
        });
        order = (maxOrder._max.order ?? -1) + 1;
      }

      const item = await tx.feedbackRubricItem.create({
        data: {
          name: data.name,
          description: data.description,
          order,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: createdById,
          action: "rubric.create",
          target: item.id,
          details: JSON.stringify({ name: data.name }),
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create rubric item",
    };
  }
}

/**
 * Update a rubric item
 */
export async function updateRubricItem(
  id: string,
  data: { name?: string; description?: string; order?: number; isActive?: boolean },
  updatedById: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.feedbackRubricItem.findUnique({
        where: { id },
        select: { name: true, isActive: true },
      });

      if (!existing) {
        throw new Error("Rubric item not found");
      }

      await tx.feedbackRubricItem.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          userId: updatedById,
          action: "rubric.update",
          target: id,
          details: JSON.stringify({
            changes: data,
            previous: { name: existing.name, isActive: existing.isActive },
          }),
        },
      });
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update rubric item",
    };
  }
}

/**
 * Soft-delete a rubric item (set isActive = false)
 */
export async function deactivateRubricItem(
  id: string,
  deactivatedById: string,
): Promise<{ success: boolean; error?: string }> {
  return updateRubricItem(id, { isActive: false }, deactivatedById);
}

/**
 * Reorder rubric items in batch
 */
export async function reorderRubricItems(
  items: { id: string; order: number }[],
  reorderedById: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.feedbackRubricItem.update({
          where: { id: item.id },
          data: { order: item.order },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: reorderedById,
          action: "rubric.reorder",
          details: JSON.stringify({ items }),
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
          : "Failed to reorder rubric items",
    };
  }
}
