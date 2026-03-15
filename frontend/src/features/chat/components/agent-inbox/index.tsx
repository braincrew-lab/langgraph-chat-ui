import { StateView } from "./components/StateView";
import { ThreadActionsView } from "./components/ThreadActionsView";
import { useState } from "react";
import { HITLRequest } from "./types";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";

interface ThreadViewProps {
  hitlRequest: HITLRequest;
}

export function ThreadView({ hitlRequest }: ThreadViewProps) {
  const thread = useStreamContext();
  const [showDescription, setShowDescription] = useState(false);
  const [showState, setShowState] = useState(false);
  const showSidePanel = showDescription || showState;

  const handleShowSidePanel = (
    showState: boolean,
    showDescription: boolean,
  ) => {
    if (showState && showDescription) {
      console.error("Cannot show both state and description");
      return;
    }
    if (showState) {
      setShowDescription(false);
      setShowState(true);
    } else if (showDescription) {
      setShowState(false);
      setShowDescription(true);
    } else {
      setShowState(false);
      setShowDescription(false);
    }
  };

  return (
    <div className="flex h-[80vh] w-full flex-col overflow-y-scroll rounded-2xl bg-gray-50/50 p-8 lg:flex-row [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
      {showSidePanel ? (
        <StateView
          handleShowSidePanel={handleShowSidePanel}
          description={hitlRequest.action_requests[0]?.description}
          values={thread.values}
          view={showState ? "state" : "description"}
        />
      ) : (
        <ThreadActionsView
          hitlRequest={hitlRequest}
          handleShowSidePanel={handleShowSidePanel}
          showState={showState}
          showDescription={showDescription}
        />
      )}
    </div>
  );
}
