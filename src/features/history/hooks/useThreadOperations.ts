import { useThreads } from "@/shared/hooks/useThreads";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { UI_TEXT } from "../constants";
import {
  deleteThreadAction,
  updateThreadAction,
} from "@/app/actions/thread";

/**
 * Custom hook for thread CRUD operations
 * Centralizes delete and update logic with error handling
 * Uses server actions for proper authentication
 */
export function useThreadOperations() {
  const { getThreads, setThreads } = useThreads();
  const [threadId, setThreadId] = useQueryState("threadId");

  const deleteThread = async (threadIdToDelete: string) => {
    try {
      // Optimistically update UI first
      setThreads((prev) => prev.filter((t) => t.thread_id !== threadIdToDelete));

      // If the deleted thread was active, reset the thread
      if (threadId === threadIdToDelete) {
        setThreadId(null);
      }

      const result = await deleteThreadAction(threadIdToDelete);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete thread");
      }

      toast.success(UI_TEXT.deleteSuccess);

      // Refresh threads list to ensure consistency
      const updatedThreads = await getThreads();
      setThreads(updatedThreads);
    } catch (error) {
      console.error("Error deleting thread:", error);
      toast.error(UI_TEXT.deleteError);

      // On error, refresh to restore the correct state
      const updatedThreads = await getThreads();
      setThreads(updatedThreads);
    }
  };

  const updateThreadTitle = async (
    threadIdToUpdate: string,
    newTitle: string,
  ) => {
    try {
      const result = await updateThreadAction(threadIdToUpdate, {
        title: newTitle,
      });

      if (!result.success) {
        throw new Error(result.error || "Failed to update thread");
      }

      toast.success(UI_TEXT.updateSuccess);

      // Refresh threads list
      const updatedThreads = await getThreads();
      setThreads(updatedThreads);
    } catch (error) {
      console.error("Error updating thread title:", error);
      toast.error(UI_TEXT.updateError);
    }
  };

  return {
    deleteThread,
    updateThreadTitle,
  };
}
