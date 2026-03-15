import { HITLRequest } from "@/features/chat/components/agent-inbox/types";

export function isAgentInboxInterruptSchema(
  value: unknown,
): value is HITLRequest {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    "action_requests" in obj &&
    Array.isArray(obj.action_requests) &&
    "review_configs" in obj &&
    Array.isArray(obj.review_configs)
  );
}
