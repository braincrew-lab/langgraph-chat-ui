import { Thread } from "@langchain/langgraph-sdk";
import { useQueryState } from "nuqs";
import { usePathname, useRouter } from "next/navigation";
import { ThreadListContainer } from "./ThreadListContainer";
import { ThreadItem } from "./thread-item";
import { useThreadOperations } from "../hooks/useThreadOperations";
import { getThreadDisplayText } from "../utils/threadHelpers";
import { useSettings } from "@/shared/hooks/useSettings";

interface ThreadListProps {
  threads: Thread[];
  onThreadClick?: (threadId: string) => void;
}

export function ThreadList({ threads, onThreadClick }: ThreadListProps) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const pathname = usePathname();
  const router = useRouter();
  const { deleteThread, updateThreadTitle } = useThreadOperations();
  const { globalSettings } = useSettings();
  const enableDeletion = globalSettings["features.enableDeletion"];

  return (
    <ThreadListContainer>
      {threads.map((t) => {
        const displayText = getThreadDisplayText(t);

        return (
          <ThreadItem
            key={t.thread_id}
            thread={t}
            isActive={threadId === t.thread_id}
            displayText={displayText}
            onSelect={() => {
              onThreadClick?.(t.thread_id);
              if (t.thread_id === threadId) return;

              // From admin routes, move to the chat page instead of only
              // mutating query params on the current admin URL.
              if (pathname.startsWith("/admin")) {
                const params = new URLSearchParams({ threadId: t.thread_id });
                router.push(`/?${params.toString()}`);
                return;
              }

              setThreadId(t.thread_id);
            }}
            onDelete={enableDeletion ? deleteThread : undefined}
            onUpdateTitle={updateThreadTitle}
          />
        );
      })}
    </ThreadListContainer>
  );
}
