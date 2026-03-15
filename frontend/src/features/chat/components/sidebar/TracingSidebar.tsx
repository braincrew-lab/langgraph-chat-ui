/**
 * TracingSidebar - LangSmith Tracing Panel
 *
 * Fixed sidebar panel for displaying LangSmith execution timeline.
 */

import { cn } from "@/lib/utils";
import { UI } from "@/lib/constants";
import { XIcon, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { ExecutionTimelinePanel } from "./ExecutionTimelinePanel";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { LangSmithTimelineEvents } from "@/types/timeline";

interface TracingSidebarProps {
  open: boolean;
  onClose: () => void;
  langSmithEvents: LangSmithTimelineEvents;
  langSmithLoading: boolean;
  onRefresh: () => void;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  isLargeScreen?: boolean;
}

export function TracingSidebar({
  open,
  onClose,
  langSmithEvents,
  langSmithLoading,
  onRefresh,
  selectedTaskId,
  onSelectTask,
  isLargeScreen = true,
}: TracingSidebarProps) {
  return (
    <motion.div
      className="bg-background fixed top-0 right-0 z-30 flex h-screen flex-col overflow-hidden border-l"
      style={{ width: UI.TRACING_SIDEBAR_WIDTH }}
      initial={false}
      animate={{ x: open ? 0 : UI.TRACING_SIDEBAR_WIDTH }}
      transition={
        isLargeScreen
          ? { type: "spring", stiffness: 300, damping: 30 }
          : { duration: 0 }
      }
    >
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">LangSmith Tracing</h2>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onRefresh}
                  disabled={langSmithLoading}
                  className="hover:bg-accent focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      langSmithLoading && "animate-spin",
                    )}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Refresh</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            onClick={onClose}
            className="hover:bg-accent focus-visible:ring-ring flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ExecutionTimelinePanel
          langSmithEvents={langSmithEvents}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
        />
      </div>
    </motion.div>
  );
}
