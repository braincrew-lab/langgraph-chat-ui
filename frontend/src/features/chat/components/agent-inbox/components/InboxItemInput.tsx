import { DecisionWithEdits, DecisionType, HITLRequest } from "../types";
import { Textarea } from "@/shared/components/ui/textarea";
import React from "react";
import { haveArgsChanged, prettifyText } from "../utils";
import { Button } from "@/shared/components/ui/button";
import { Undo2 } from "lucide-react";
import { MarkdownText } from "../../content/MarkdownText";
import { toast } from "sonner";
import { Separator } from "@/shared/components/ui/separator";

function ResetButton({ handleReset }: { handleReset: () => void }) {
  return (
    <Button
      onClick={handleReset}
      variant="ghost"
      className="flex items-center justify-center gap-2 text-gray-500 hover:text-red-500"
    >
      <Undo2 className="h-4 w-4" />
      <span>Reset</span>
    </Button>
  );
}

function ArgsRenderer({ args }: { args: Record<string, unknown> }) {
  return (
    <div className="flex w-full flex-col items-start gap-6">
      {Object.entries(args).map(([k, v]) => {
        let value = "";
        if (["string", "number"].includes(typeof v)) {
          value = String(v);
        } else {
          value = JSON.stringify(v, null);
        }

        return (
          <div
            key={`args-${k}`}
            className="flex flex-col items-start gap-1"
          >
            <p className="text-sm leading-[18px] text-wrap text-gray-600">
              {prettifyText(k)}:
            </p>
            <span className="w-full max-w-full rounded-xl bg-zinc-100 p-3 text-[13px] leading-[18px] text-black">
              <MarkdownText>{value}</MarkdownText>
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface InboxItemInputProps {
  hitlRequest: HITLRequest;
  currentActionIndex: number;
  decisions: DecisionWithEdits[];
  supportsMultipleMethods: boolean;
  approveAllowed: boolean;
  hasEdited: boolean;
  hasAddedReject: boolean;
  initialValues: Record<string, string>;

  streaming: boolean;
  streamFinished: boolean;

  setDecisions: React.Dispatch<React.SetStateAction<DecisionWithEdits[]>>;
  setSelectedSubmitType: React.Dispatch<
    React.SetStateAction<DecisionType | undefined>
  >;
  setHasAddedReject: React.Dispatch<React.SetStateAction<boolean>>;
  setHasEdited: React.Dispatch<React.SetStateAction<boolean>>;

  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}

function RejectComponent({
  decisions,
  currentActionIndex,
  streaming,
  showArgsInReject,
  hitlRequest,
  onRejectChange,
  handleSubmit,
}: {
  decisions: DecisionWithEdits[];
  currentActionIndex: number;
  streaming: boolean;
  showArgsInReject: boolean;
  hitlRequest: HITLRequest;
  onRejectChange: (message: string) => void;
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}) {
  const decision = decisions[currentActionIndex];
  if (!decision) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const currentAR = hitlRequest.action_requests[currentActionIndex];

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-xl border-[1px] border-gray-300 p-6">
      <div className="flex w-full items-center justify-between">
        <p className="text-base font-semibold text-black">Reject</p>
        <ResetButton
          handleReset={() => {
            onRejectChange("");
          }}
        />
      </div>

      {showArgsInReject && currentAR && (
        <ArgsRenderer args={currentAR.args} />
      )}

      <div className="flex w-full flex-col items-start gap-[6px]">
        <p className="min-w-fit text-sm font-medium">Rejection reason</p>
        <Textarea
          disabled={streaming}
          value={decision.message}
          onChange={(e) => onRejectChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          placeholder="Reason for rejection..."
        />
      </div>

      <div className="flex w-full items-center justify-end gap-2">
        <Button
          variant="brand"
          disabled={streaming}
          onClick={handleSubmit}
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
const Reject = React.memo(RejectComponent);

function ApproveComponent({
  streaming,
  actionRequestArgs,
  handleSubmit,
}: {
  streaming: boolean;
  actionRequestArgs: Record<string, unknown>;
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}) {
  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border-[1px] border-gray-300 p-6">
      {actionRequestArgs && Object.keys(actionRequestArgs).length > 0 && (
        <ArgsRenderer args={actionRequestArgs} />
      )}
      <Button
        variant="brand"
        disabled={streaming}
        onClick={handleSubmit}
        className="w-full"
      >
        Approve
      </Button>
    </div>
  );
}

function EditAndOrApproveComponent({
  decisions,
  currentActionIndex,
  streaming,
  initialValues,
  onEditChange,
  handleSubmit,
  hitlRequest,
}: {
  decisions: DecisionWithEdits[];
  currentActionIndex: number;
  streaming: boolean;
  initialValues: Record<string, string>;
  hitlRequest: HITLRequest;
  onEditChange: (change: string | string[], key: string | string[]) => void;
  handleSubmit: (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent> | React.KeyboardEvent,
  ) => Promise<void>;
}) {
  const defaultRows = React.useRef<Record<string, number>>({});
  const decision = decisions[currentActionIndex];
  if (!decision) return null;

  const currentAR = hitlRequest.action_requests[currentActionIndex];
  const currentRC =
    hitlRequest.review_configs.find(
      (rc) => rc.action_name === currentAR?.name,
    ) ?? hitlRequest.review_configs[currentActionIndex];
  const allowedDecisions = currentRC?.allowed_decisions ?? [];
  const isEditAllowed = allowedDecisions.includes("edit");
  const isApproveAllowed = allowedDecisions.includes("approve");

  if (!isEditAllowed) {
    if (isApproveAllowed && currentAR) {
      return (
        <ApproveComponent
          actionRequestArgs={currentAR.args}
          streaming={streaming}
          handleSubmit={handleSubmit}
        />
      );
    }
    return null;
  }

  const header = isApproveAllowed ? "Edit/Approve" : "Edit";
  let buttonText = "Submit";
  if (isApproveAllowed && !decision.editsMade) {
    buttonText = "Approve";
  }

  const handleReset = () => {
    const keysToReset: string[] = [];
    const valuesToReset: string[] = [];
    Object.entries(initialValues).forEach(([k, v]) => {
      if (k in decision.edited_action.args) {
        const value = ["string", "number"].includes(typeof v)
          ? v
          : JSON.stringify(v, null);
        keysToReset.push(k);
        valuesToReset.push(value);
      }
    });

    if (keysToReset.length > 0 && valuesToReset.length > 0) {
      onEditChange(valuesToReset, keysToReset);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex w-full flex-col items-start gap-4 rounded-lg border-[1px] border-gray-300 p-6">
      <div className="flex w-full items-center justify-between">
        <p className="text-base font-semibold text-black">{header}</p>
        <ResetButton handleReset={handleReset} />
      </div>

      {Object.entries(decision.edited_action.args).map(([k, v], idx) => {
        const value = ["string", "number"].includes(typeof v)
          ? v
          : JSON.stringify(v, null);
        if (
          defaultRows.current[k as keyof typeof defaultRows.current] ===
          undefined
        ) {
          const strValue = String(value);
          defaultRows.current[k as keyof typeof defaultRows.current] =
            !strValue.length ? 3 : Math.max(strValue.length / 30, 7);
        }
        const numRows =
          defaultRows.current[k as keyof typeof defaultRows.current] || 8;

        return (
          <div
            className="flex h-full w-full flex-col items-start gap-1 px-[1px]"
            key={`allow-edit-args--${k}-${idx}`}
          >
            <div className="flex w-full flex-col items-start gap-[6px]">
              <p className="min-w-fit text-sm font-medium">{prettifyText(k)}</p>
              <Textarea
                disabled={streaming}
                className="h-full"
                value={value as string}
                onChange={(e) => onEditChange(e.target.value, k)}
                onKeyDown={handleKeyDown}
                rows={numRows}
              />
            </div>
          </div>
        );
      })}

      <div className="flex w-full items-center justify-end gap-2">
        <Button
          variant="brand"
          disabled={streaming}
          onClick={handleSubmit}
        >
          {buttonText}
        </Button>
      </div>
    </div>
  );
}
const EditAndOrApprove = React.memo(EditAndOrApproveComponent);

export function InboxItemInput({
  hitlRequest,
  currentActionIndex,
  decisions,
  streaming,
  streamFinished,
  supportsMultipleMethods,
  approveAllowed,
  hasEdited,
  hasAddedReject,
  initialValues,
  setDecisions,
  setSelectedSubmitType,
  setHasEdited,
  setHasAddedReject,
  handleSubmit,
}: InboxItemInputProps) {
  const currentAR = hitlRequest.action_requests[currentActionIndex];
  const currentRC =
    hitlRequest.review_configs.find(
      (rc) => rc.action_name === currentAR?.name,
    ) ?? hitlRequest.review_configs[currentActionIndex];
  const allowedDecisions = currentRC?.allowed_decisions ?? [];

  const isEditAllowed = allowedDecisions.includes("edit");
  const isRejectAllowed = allowedDecisions.includes("reject");
  const isApproveAllowed = allowedDecisions.includes("approve");

  const hasArgs = Object.entries(currentAR?.args ?? {}).length > 0;
  const showArgsInReject =
    hasArgs && !isEditAllowed && !isApproveAllowed && isRejectAllowed;
  const showArgsOutsideActionCards =
    hasArgs && !showArgsInReject && !isEditAllowed && !isApproveAllowed;

  const onEditChange = (change: string | string[], key: string | string[]) => {
    if (
      (Array.isArray(change) && !Array.isArray(key)) ||
      (!Array.isArray(change) && Array.isArray(key))
    ) {
      toast.error("Error", {
        description: "Something went wrong",
        richColors: true,
        closeButton: true,
      });
      return;
    }

    const decision = decisions[currentActionIndex];
    if (!decision) return;

    const updatedArgs = { ...decision.edited_action.args };

    if (Array.isArray(change) && Array.isArray(key)) {
      change.forEach((value, index) => {
        if (index < key.length) {
          updatedArgs[key[index]] = value;
        }
      });
    } else {
      updatedArgs[key as string] = change as string;
    }

    const valuesChanged = haveArgsChanged(updatedArgs, initialValues);

    if (!valuesChanged) {
      setHasEdited(false);
      if (isApproveAllowed) {
        setSelectedSubmitType("approve");
      } else if (hasAddedReject) {
        setSelectedSubmitType("reject");
      }
    } else {
      setSelectedSubmitType("edit");
      setHasEdited(true);
    }

    setDecisions((prev) =>
      prev.map((d, idx) => {
        if (idx === currentActionIndex) {
          return {
            ...d,
            edited_action: { ...d.edited_action, args: updatedArgs },
            editsMade: valuesChanged,
          };
        }
        return d;
      }),
    );
  };

  const onRejectChange = (message: string) => {
    if (!message) {
      setHasAddedReject(false);
      if (hasEdited) {
        setSelectedSubmitType("edit");
      } else if (approveAllowed) {
        setSelectedSubmitType("approve");
      }
    } else {
      setSelectedSubmitType("reject");
      setHasAddedReject(true);
    }

    setDecisions((prev) =>
      prev.map((d, idx) => {
        if (idx === currentActionIndex) {
          return { ...d, message };
        }
        return d;
      }),
    );
  };

  return (
    <div className="flex w-full flex-col items-start justify-start gap-2">
      {showArgsOutsideActionCards && currentAR && (
        <ArgsRenderer args={currentAR.args} />
      )}

      <div className="flex w-full flex-col items-start gap-2">
        <EditAndOrApprove
          decisions={decisions}
          currentActionIndex={currentActionIndex}
          streaming={streaming}
          initialValues={initialValues}
          hitlRequest={hitlRequest}
          onEditChange={onEditChange}
          handleSubmit={handleSubmit}
        />
        {supportsMultipleMethods ? (
          <div className="mx-auto mt-3 flex items-center gap-3">
            <Separator className="w-[full]" />
            <p className="text-sm text-gray-500">Or</p>
            <Separator className="w-full" />
          </div>
        ) : null}
        {isRejectAllowed && (
          <Reject
            decisions={decisions}
            currentActionIndex={currentActionIndex}
            streaming={streaming}
            showArgsInReject={showArgsInReject}
            hitlRequest={hitlRequest}
            onRejectChange={onRejectChange}
            handleSubmit={handleSubmit}
          />
        )}
        {streaming && <p className="text-sm text-gray-600">Running...</p>}
        {streamFinished && (
          <p className="text-base font-medium text-green-600">
            Successfully finished Graph invocation.
          </p>
        )}
      </div>
    </div>
  );
}
