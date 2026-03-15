import { DecisionWithEdits, DecisionType, Decision, HITLRequest } from "../types";
import {
  KeyboardEvent,
  Dispatch,
  SetStateAction,
  MutableRefObject,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { createDefaultDecisions, buildDecisionFromState } from "../utils";
import { toast } from "sonner";
import { END } from "@langchain/langgraph/web";
import { useStreamContext } from "@/features/chat/hooks/useStreamContext";

interface UseInterruptedActionsInput {
  hitlRequest: HITLRequest;
}

interface UseInterruptedActionsValue {
  // Actions
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | KeyboardEvent,
  ) => Promise<void>;
  handleResolve: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => Promise<void>;
  handleApproveAll: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => Promise<void>;
  handleSubmitAll: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => Promise<void>;
  goToNextAction: () => void;
  goToPreviousAction: () => void;

  // State values
  streaming: boolean;
  streamFinished: boolean;
  loading: boolean;
  supportsMultipleMethods: boolean;
  hasEdited: boolean;
  hasAddedReject: boolean;
  approveAllowed: boolean;
  decisions: DecisionWithEdits[];
  currentActionIndex: number;
  canApproveAll: boolean;
  allActionsAddressed: boolean;
  totalActions: number;
  addressedActions: Map<number, Decision>;

  // State setters
  setSelectedSubmitType: Dispatch<SetStateAction<DecisionType | undefined>>;
  setDecisions: Dispatch<SetStateAction<DecisionWithEdits[]>>;
  setHasAddedReject: Dispatch<SetStateAction<boolean>>;
  setHasEdited: Dispatch<SetStateAction<boolean>>;

  // Refs
  initialHumanInterruptEditValue: MutableRefObject<Record<string, string>>;
}

export default function useInterruptedActions({
  hitlRequest,
}: UseInterruptedActionsInput): UseInterruptedActionsValue {
  const thread = useStreamContext();
  const [decisions, setDecisions] = useState<DecisionWithEdits[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamFinished, setStreamFinished] = useState(false);
  const initialHumanInterruptEditValue = useRef<Record<string, string>>({});
  const [selectedSubmitType, setSelectedSubmitType] =
    useState<DecisionType>();
  const [hasEdited, setHasEdited] = useState(false);
  const [hasAddedReject, setHasAddedReject] = useState(false);
  const [approveAllowed, setApproveAllowed] = useState(false);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [addressedActions, setAddressedActions] = useState<
    Map<number, Decision>
  >(new Map());

  const totalActions = hitlRequest.action_requests.length;

  useEffect(() => {
    try {
      const {
        decisions: defaultDecisions,
        defaultSubmitType,
        approveAllowed: hasApprove,
      } = createDefaultDecisions(hitlRequest, initialHumanInterruptEditValue);
      setSelectedSubmitType(defaultSubmitType);
      setDecisions(defaultDecisions);
      setApproveAllowed(hasApprove);
      setCurrentActionIndex(0);
      setAddressedActions(new Map());
    } catch (e) {
      console.error("Error formatting and setting decision state", e);
    }
  }, [hitlRequest]);

  const canApproveAll = useMemo(() => {
    return hitlRequest.action_requests.every((ar, idx) => {
      const rc =
        hitlRequest.review_configs.find((c) => c.action_name === ar.name) ??
        hitlRequest.review_configs[idx];
      return rc?.allowed_decisions.includes("approve");
    });
  }, [hitlRequest]);

  const allActionsAddressed = addressedActions.size === totalActions;

  const resumeRun = (resumeValue: unknown): boolean => {
    try {
      thread.submit({}, { command: { resume: resumeValue } });
      return true;
    } catch (e: unknown) {
      console.error("Error sending decision", e);
      return false;
    }
  };

  const sendDecisions = (finalDecisions: Decision[]) => {
    setStreamFinished(false);
    setLoading(true);
    setStreaming(true);

    try {
      const success = resumeRun(finalDecisions);
      if (!success) return;

      toast("Success", {
        description: "Decisions submitted successfully.",
        duration: 5000,
      });
      setStreamFinished(true);
    } catch (e: unknown) {
      console.error("Error sending decisions", e);
      const error = e as { message?: string };
      if (error.message?.includes("Invalid assistant ID")) {
        toast("Error: Invalid assistant ID", {
          description:
            "The provided assistant ID was not found in this graph. Please update the assistant ID in the settings and try again.",
          richColors: true,
          closeButton: true,
          duration: 5000,
        });
      } else {
        toast.error("Error", {
          description: "Failed to submit decisions.",
          richColors: true,
          closeButton: true,
          duration: 5000,
        });
      }
      setStreaming(false);
      setStreamFinished(false);
      setLoading(false);
      return;
    }

    setStreaming(false);
    setLoading(false);
  };

  const handleSubmit = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | KeyboardEvent,
  ) => {
    e.preventDefault();
    const currentDecision = decisions[currentActionIndex];
    if (!currentDecision || !selectedSubmitType) {
      toast.error("Error", {
        description: "Please select a decision type.",
        duration: 5000,
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const finalDecision = buildDecisionFromState(
      currentDecision,
      selectedSubmitType,
    );
    if (!finalDecision) {
      if (selectedSubmitType === "reject") {
        toast.error("Error", {
          description: "Please provide a rejection message.",
          duration: 5000,
          richColors: true,
          closeButton: true,
        });
      } else {
        toast.error("Error", {
          description: "Failed to build decision.",
          duration: 5000,
          richColors: true,
          closeButton: true,
        });
      }
      return;
    }

    initialHumanInterruptEditValue.current = {};

    if (totalActions === 1) {
      sendDecisions([finalDecision]);
    } else {
      const nextAddressed = new Map(addressedActions);
      nextAddressed.set(currentActionIndex, finalDecision);
      setAddressedActions(nextAddressed);

      toast("Decision recorded", {
        description: `Action ${currentActionIndex + 1} of ${totalActions} addressed.`,
        duration: 3000,
      });

      // Auto-advance to next unaddressed action
      for (let i = 1; i <= totalActions; i++) {
        const nextIdx = (currentActionIndex + i) % totalActions;
        if (!nextAddressed.has(nextIdx)) {
          setCurrentActionIndex(nextIdx);
          break;
        }
      }
    }
  };

  const handleResolve = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.preventDefault();
    setLoading(true);
    initialHumanInterruptEditValue.current = {};

    try {
      thread.submit(
        {},
        {
          command: {
            goto: END,
          },
        },
      );

      toast("Success", {
        description: "Marked thread as resolved.",
        duration: 3000,
      });
    } catch (e) {
      console.error("Error marking thread as resolved", e);
      toast.error("Error", {
        description: "Failed to mark thread as resolved.",
        richColors: true,
        closeButton: true,
        duration: 3000,
      });
    }

    setLoading(false);
  };

  const handleApproveAll = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.preventDefault();
    if (!canApproveAll) {
      toast.error("Error", {
        description: "Not all actions support approval.",
        duration: 5000,
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const allApproved: Decision[] = hitlRequest.action_requests.map((ar) => ({
      type: "approve" as const,
      action: { name: ar.name, args: ar.args },
    }));

    initialHumanInterruptEditValue.current = {};
    sendDecisions(allApproved);
  };

  const handleSubmitAll = async (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.preventDefault();
    if (!allActionsAddressed) {
      toast.error("Error", {
        description: "Not all actions have been addressed.",
        duration: 5000,
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const finalDecisions: Decision[] = [];
    for (let i = 0; i < totalActions; i++) {
      const decision = addressedActions.get(i);
      if (!decision) {
        toast.error("Error", {
          description: `Action ${i + 1} has not been addressed.`,
          duration: 5000,
          richColors: true,
          closeButton: true,
        });
        return;
      }
      finalDecisions.push(decision);
    }

    initialHumanInterruptEditValue.current = {};
    sendDecisions(finalDecisions);
  };

  const goToNextAction = useCallback(() => {
    setCurrentActionIndex((prev) => Math.min(prev + 1, totalActions - 1));
  }, [totalActions]);

  const goToPreviousAction = useCallback(() => {
    setCurrentActionIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const supportsMultipleMethods = useMemo(() => {
    const currentAR = hitlRequest.action_requests[currentActionIndex];
    if (!currentAR) return false;
    const rc =
      hitlRequest.review_configs.find(
        (c) => c.action_name === currentAR.name,
      ) ?? hitlRequest.review_configs[currentActionIndex];
    const allowed = rc?.allowed_decisions ?? [];
    return (
      allowed.filter(
        (d) => d === "edit" || d === "approve" || d === "reject",
      ).length > 1
    );
  }, [hitlRequest, currentActionIndex]);

  return {
    handleSubmit,
    handleResolve,
    handleApproveAll,
    handleSubmitAll,
    goToNextAction,
    goToPreviousAction,
    decisions,
    streaming,
    streamFinished,
    loading,
    supportsMultipleMethods,
    hasEdited,
    hasAddedReject,
    approveAllowed,
    currentActionIndex,
    canApproveAll,
    allActionsAddressed,
    totalActions,
    addressedActions,
    setSelectedSubmitType,
    setDecisions,
    setHasAddedReject,
    setHasEdited,
    initialHumanInterruptEditValue,
  };
}
