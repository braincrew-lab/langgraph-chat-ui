import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Assistant } from "@/app/actions/assistant";
import { useTranslations } from "next-intl";

interface AssistantSelectorProps {
  assistants: Assistant[];
  selectedAssistantId?: string;
  isLoading: boolean;
  onSelect: (assistantId: string) => void;
  onRefresh: () => void;
}

function formatAssistantLabel(assistant?: Assistant | null) {
  if (!assistant) {
    return "";
  }
  if (assistant.name && assistant.graph_id) {
    return `${assistant.name}`;
  }
  return assistant.name || assistant.graph_id || assistant.assistant_id;
}

export function AssistantSelector({
  assistants,
  selectedAssistantId,
  isLoading,
  onSelect,
  onRefresh,
}: AssistantSelectorProps) {
  const t = useTranslations("chat");

  return (
    <div className="border-border bg-card flex cursor-pointer gap-1 rounded-lg border pr-1 pl-3 shadow-sm transition-all duration-200 hover:shadow-md">
      <select
        id="assistant-selector"
        value={selectedAssistantId ?? "none"}
        onChange={(e) => {
          const value = e.target.value;
          if (value === selectedAssistantId) {
            return;
          }
          onSelect(value);
        }}
        disabled={assistants.length === 0 || isLoading}
        className="focus-visible:ring-ring w-full cursor-pointer rounded-xl border-none bg-transparent px-0 py-2 text-sm outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70 aria-selected:border-none"
      >
        <option value="none">
          {isLoading
            ? t("assistant.loading")
            : assistants.length === 0
              ? t("assistant.noGraphs")
              : t("assistant.selectGraph")}
        </option>
        {assistants.map((assistant) => (
          <option
            key={assistant.assistant_id}
            value={assistant.assistant_id}
          >
            {formatAssistantLabel(assistant)}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw
          className={cn("h-3.5 w-3.5", isLoading ? "animate-spin" : "")}
        />
      </button>
    </div>
  );
}
