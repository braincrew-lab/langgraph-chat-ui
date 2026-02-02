"use client";

import { XIcon, RefreshCw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { ExecutionTimelinePanel } from "../sidebar/ExecutionTimelinePanel";
import { cn } from "@/lib/utils";
import { UI } from "@/lib/constants";
import type { LangSmithTimelineEvents } from "@/types/timeline";

interface ThreadTracingSidebarProps {
  langSmithEvents: LangSmithTimelineEvents;
  langSmithLoading: boolean;
  refetchLangSmith: () => void;
  selectedTaskId: string | null;
  onSelectTask: (taskId: string | null) => void;
  onClose: () => void;
}

export function ThreadTracingSidebar({
  langSmithEvents,
  langSmithLoading,
  refetchLangSmith,
  selectedTaskId,
  onSelectTask,
  onClose,
}: ThreadTracingSidebarProps) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden border-l"
      style={{ width: UI.TRACING_SIDEBAR_WIDTH }}
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">LangSmith Tracing</h2>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => refetchLangSmith()}
                  disabled={langSmithLoading}
                  className="hover:bg-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50"
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
            className="hover:bg-accent flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <ExecutionTimelinePanel
          langSmithEvents={langSmithEvents}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
        />
      </div>
    </div>
  );
}
