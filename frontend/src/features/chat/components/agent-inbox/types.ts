import { BaseMessage } from "@langchain/core/messages";
import { Thread, ThreadStatus } from "@langchain/langgraph-sdk";

export type DecisionType = "approve" | "edit" | "reject";

export interface Action {
  name: string;
  args: Record<string, unknown>;
}

export interface ActionRequest {
  name: string;
  args: Record<string, unknown>;
  description?: string;
}

export interface ReviewConfig {
  action_name: string;
  allowed_decisions: DecisionType[];
  args_schema?: Record<string, unknown>;
}

export interface HITLRequest {
  action_requests: ActionRequest[];
  review_configs: ReviewConfig[];
}

export type Decision =
  | { type: "approve"; action: Action }
  | { type: "reject"; action: Action; message: string }
  | { type: "edit"; action: Action; edited_action: Action };

export interface DecisionWithEdits {
  type: DecisionType;
  action: Action;
  edited_action: Action;
  message: string;
  approveAllowed: boolean;
  editsMade: boolean;
}

export type Email = {
  id: string;
  thread_id: string;
  from_email: string;
  to_email: string;
  subject: string;
  page_content: string;
  send_time: string | undefined;
  read?: boolean;
  status?: "in-queue" | "processing" | "hitl" | "done";
};

export interface ThreadValues {
  email: Email;
  messages: BaseMessage[];
  triage: {
    logic: string;
    response: string;
  };
}

export type ThreadData<
  ThreadValues extends Record<string, unknown> = Record<string, unknown>,
> = {
  thread: Thread<ThreadValues>;
} & (
  | {
      status: "interrupted";
      interrupts: HITLRequest[] | undefined;
    }
  | {
      status: "idle" | "busy" | "error";
      interrupts?: never;
    }
);

export type ThreadStatusWithAll = ThreadStatus | "all";

export interface AgentInbox {
  /**
   * A unique identifier for the inbox.
   */
  id: string;
  /**
   * The ID of the graph.
   */
  graphId: string;
  /**
   * The URL of the deployment. Either a localhost URL, or a deployment URL.
   */
  deploymentUrl: string;
  /**
   * Optional name for the inbox, used in the UI to label the inbox.
   */
  name?: string;
  /**
   * Whether or not the inbox is selected.
   */
  selected: boolean;
}
