import { BaseMessage, isBaseMessage } from "@langchain/core/messages";
import { format } from "date-fns";
import { startCase } from "lodash";
import {
  DecisionWithEdits,
  DecisionType,
  HITLRequest,
  Decision,
} from "./types";

export function prettifyText(action: string) {
  return startCase(action.replace(/_/g, " "));
}

export function isArrayOfMessages(value: unknown): value is BaseMessage[] {
  if (!Array.isArray(value)) return false;
  if (
    value.every(isBaseMessage) ||
    (Array.isArray(value) &&
      value.every(
        (v) =>
          typeof v === "object" &&
          "id" in v &&
          "type" in v &&
          "content" in v &&
          "additional_kwargs" in v,
      ))
  ) {
    return true;
  }
  return false;
}

export function baseMessageObject(item: unknown): string {
  if (isBaseMessage(item)) {
    const contentText =
      typeof item.content === "string"
        ? item.content
        : JSON.stringify(item.content, null);
    let toolCallText = "";
    if ("tool_calls" in item) {
      toolCallText = JSON.stringify(item.tool_calls, null);
    }
    const type = item.getType();
    return `${type}:${contentText ? ` ${contentText}` : ""}${toolCallText ? ` - Tool calls: ${toolCallText}` : ""}`;
  } else if (
    typeof item === "object" &&
    item &&
    "type" in item &&
    "content" in item
  ) {
    const contentText =
      typeof item.content === "string"
        ? item.content
        : JSON.stringify(item.content, null);
    let toolCallText = "";
    if ("tool_calls" in item) {
      toolCallText = JSON.stringify(item.tool_calls, null);
    }
    return `${item.type}:${contentText ? ` ${contentText}` : ""}${toolCallText ? ` - Tool calls: ${toolCallText}` : ""}`;
  }

  if (typeof item === "object") {
    return JSON.stringify(item, null);
  } else {
    return item as string;
  }
}

export function unknownToPrettyDate(input: unknown): string | undefined {
  try {
    if (
      Object.prototype.toString.call(input) === "[object Date]" ||
      new Date(input as string)
    ) {
      return format(new Date(input as string), "MM/dd/yyyy hh:mm a");
    }
  } catch {
    // failed to parse date. no-op
  }
  return undefined;
}

export function createDefaultDecisions(
  hitlRequest: HITLRequest,
  initialEditValues: React.MutableRefObject<Record<string, string>>,
): {
  decisions: DecisionWithEdits[];
  defaultSubmitType: DecisionType | undefined;
  approveAllowed: boolean;
} {
  const decisions: DecisionWithEdits[] = hitlRequest.action_requests.map(
    (actionRequest, idx) => {
      const reviewConfig =
        hitlRequest.review_configs.find(
          (rc) => rc.action_name === actionRequest.name,
        ) ?? hitlRequest.review_configs[idx];

      const allowedDecisions = reviewConfig?.allowed_decisions ?? [];
      const canApprove = allowedDecisions.includes("approve");
      const canEdit = allowedDecisions.includes("edit");

      if (canEdit) {
        Object.entries(actionRequest.args).forEach(([k, v]) => {
          const stringValue =
            typeof v === "string" ? v : JSON.stringify(v, null);
          if (!initialEditValues.current || !(k in initialEditValues.current)) {
            initialEditValues.current = {
              ...initialEditValues.current,
              [k]: stringValue,
            };
          } else if (
            k in initialEditValues.current &&
            initialEditValues.current[k] !== stringValue
          ) {
            console.error(
              "KEY AND VALUE FOUND IN initialEditValues.current THAT DOES NOT MATCH THE ACTION REQUEST",
              {
                key: k,
                value: stringValue,
                expectedValue: initialEditValues.current[k],
              },
            );
          }
        });
      }

      let defaultType: DecisionType;
      if (canApprove) defaultType = "approve";
      else if (canEdit) defaultType = "edit";
      else defaultType = "reject";

      return {
        type: defaultType,
        action: { name: actionRequest.name, args: actionRequest.args },
        edited_action: {
          name: actionRequest.name,
          args: { ...actionRequest.args },
        },
        message: "",
        approveAllowed: canApprove,
        editsMade: false,
      };
    },
  );

  let defaultSubmitType: DecisionType | undefined;
  if (decisions.length > 0) {
    defaultSubmitType = decisions[0].type;
  }

  const approveAllowed = decisions.some((d) => d.approveAllowed);

  return { decisions, defaultSubmitType, approveAllowed };
}

export function buildDecisionFromState(
  decision: DecisionWithEdits,
  submitType: DecisionType,
): Decision | null {
  if (submitType === "approve") {
    return { type: "approve", action: decision.action };
  }
  if (submitType === "reject") {
    if (!decision.message) return null;
    return {
      type: "reject",
      action: decision.action,
      message: decision.message,
    };
  }
  if (submitType === "edit") {
    if (decision.approveAllowed && !decision.editsMade) {
      return { type: "approve", action: decision.action };
    }
    return {
      type: "edit",
      action: decision.action,
      edited_action: decision.edited_action,
    };
  }
  return null;
}

export function constructOpenInStudioURL(
  deploymentUrl: string,
  threadId?: string,
) {
  const smithStudioURL = new URL("https://smith.langchain.com/studio/thread");
  // trim the trailing slash from deploymentUrl
  const trimmedDeploymentUrl = deploymentUrl.replace(/\/$/, "");

  if (threadId) {
    smithStudioURL.pathname += `/${threadId}`;
  }

  smithStudioURL.searchParams.append("baseUrl", trimmedDeploymentUrl);

  return smithStudioURL.toString();
}

export function haveArgsChanged(
  args: unknown,
  initialValues: Record<string, string>,
): boolean {
  if (typeof args !== "object" || !args) {
    return false;
  }

  const currentValues = args as Record<string, string>;

  return Object.entries(currentValues).some(([key, value]) => {
    const valueString = ["string", "number"].includes(typeof value)
      ? value.toString()
      : JSON.stringify(value, null);
    return initialValues[key] !== valueString;
  });
}
