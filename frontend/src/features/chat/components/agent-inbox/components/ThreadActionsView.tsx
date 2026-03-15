import { Button } from "@/shared/components/ui/button";
import { ThreadIdCopyable } from "./ThreadId";
import { InboxItemInput } from "./InboxItemInput";
import useInterruptedActions from "../hooks/useInterruptedActions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";
import { constructOpenInStudioURL } from "../utils";
import { HITLRequest } from "../types";
import { useQueryState } from "nuqs";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ThreadActionsViewProps {
  hitlRequest: HITLRequest;
  handleShowSidePanel: (showState: boolean, showDescription: boolean) => void;
  showState: boolean;
  showDescription: boolean;
}

function ButtonGroup({
  handleShowState,
  handleShowDescription,
  showingState,
  showingDescription,
}: {
  handleShowState: () => void;
  handleShowDescription: () => void;
  showingState: boolean;
  showingDescription: boolean;
}) {
  return (
    <div className="flex flex-row items-center justify-center gap-0">
      <Button
        variant="outline"
        className={cn(
          "rounded-l-md rounded-r-none border-r-[0px]",
          showingState ? "text-black" : "bg-white",
        )}
        size="sm"
        onClick={handleShowState}
      >
        State
      </Button>
      <Button
        variant="outline"
        className={cn(
          "rounded-l-none rounded-r-md border-l-[0px]",
          showingDescription ? "text-black" : "bg-white",
        )}
        size="sm"
        onClick={handleShowDescription}
      >
        Description
      </Button>
    </div>
  );
}

export function ThreadActionsView({
  hitlRequest,
  handleShowSidePanel,
  showDescription,
  showState,
}: ThreadActionsViewProps) {
  const [threadId] = useQueryState("threadId");
  const {
    approveAllowed,
    hasEdited,
    hasAddedReject,
    streaming,
    supportsMultipleMethods,
    streamFinished,
    loading,
    handleSubmit,
    handleResolve,
    handleApproveAll,
    handleSubmitAll,
    goToNextAction,
    goToPreviousAction,
    setSelectedSubmitType,
    setHasAddedReject,
    setHasEdited,
    decisions,
    setDecisions,
    initialHumanInterruptEditValue,
    currentActionIndex,
    canApproveAll,
    allActionsAddressed,
    totalActions,
    addressedActions,
  } = useInterruptedActions({
    hitlRequest,
  });
  const { apiUrl } = useStreamContext();

  const handleOpenInStudio = () => {
    if (!apiUrl) {
      toast.error("Error", {
        description: "Please set the LangGraph deployment URL in settings.",
        duration: 5000,
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const studioUrl = constructOpenInStudioURL(apiUrl, threadId ?? undefined);
    window.open(studioUrl, "_blank");
  };

  const threadTitle =
    hitlRequest.action_requests[currentActionIndex]?.name || "Unknown";
  const actionsDisabled = loading || streaming;

  return (
    <div className="flex min-h-full w-full flex-col gap-9">
      {/* Header */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center justify-start gap-3">
          <p className="text-2xl tracking-tighter text-pretty">{threadTitle}</p>
          {threadId && <ThreadIdCopyable threadId={threadId} />}
        </div>
        <div className="flex flex-row items-center justify-start gap-2">
          {apiUrl && (
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-1 bg-white"
              onClick={handleOpenInStudio}
            >
              Studio
            </Button>
          )}
          <ButtonGroup
            handleShowState={() => handleShowSidePanel(true, false)}
            handleShowDescription={() => handleShowSidePanel(false, true)}
            showingState={showState}
            showingDescription={showDescription}
          />
        </div>
      </div>

      {/* Action buttons row */}
      <div className="flex w-full flex-row items-center justify-start gap-2">
        <Button
          variant="outline"
          className="border-gray-500 bg-white font-normal text-gray-800"
          onClick={handleResolve}
          disabled={actionsDisabled}
        >
          Mark as Resolved
        </Button>
        {canApproveAll && totalActions > 1 && (
          <Button
            variant="outline"
            className="border-green-500 bg-white font-normal text-green-700"
            onClick={handleApproveAll}
            disabled={actionsDisabled}
          >
            Approve All
          </Button>
        )}
      </div>

      {/* Multi-action progress bar */}
      {totalActions > 1 && (
        <div className="flex w-full flex-col gap-2">
          <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
            {Array.from({ length: totalActions }).map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-full flex-1 rounded-full",
                  idx === currentActionIndex
                    ? "bg-blue-500"
                    : addressedActions.has(idx)
                      ? "bg-green-500"
                      : "bg-gray-300",
                )}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousAction}
              disabled={currentActionIndex === 0 || actionsDisabled}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Action {currentActionIndex + 1} of {totalActions}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextAction}
              disabled={
                currentActionIndex === totalActions - 1 || actionsDisabled
              }
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      <InboxItemInput
        approveAllowed={approveAllowed}
        hasEdited={hasEdited}
        hasAddedReject={hasAddedReject}
        hitlRequest={hitlRequest}
        currentActionIndex={currentActionIndex}
        decisions={decisions}
        initialValues={initialHumanInterruptEditValue.current}
        setDecisions={setDecisions}
        streaming={streaming}
        streamFinished={streamFinished}
        supportsMultipleMethods={supportsMultipleMethods}
        setSelectedSubmitType={setSelectedSubmitType}
        setHasAddedReject={setHasAddedReject}
        setHasEdited={setHasEdited}
        handleSubmit={handleSubmit}
      />

      {/* Submit all button for multi-action */}
      {totalActions > 1 && allActionsAddressed && (
        <Button
          variant="brand"
          className="w-full"
          onClick={handleSubmitAll}
          disabled={actionsDisabled}
        >
          Submit all {totalActions} decisions
        </Button>
      )}
    </div>
  );
}
