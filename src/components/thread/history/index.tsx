"use client";

import { useThreads } from "@/hooks/useThreads";
import { useAssistantConfig } from "@/hooks/useAssistantConfig";
import { useEffect } from "react";
import { useQueryState } from "nuqs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { MobileSidebar } from "./components/MobileSidebar";

interface ThreadHistoryProps {
  onShowGuide?: () => void;
  chatHistoryOpen: boolean;
  onChatHistoryOpenChange: (open: boolean) => void;
}

export default function ThreadHistory({
  onShowGuide,
  chatHistoryOpen,
  onChatHistoryOpenChange,
}: ThreadHistoryProps) {
  const { assistantId } = useAssistantConfig();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [_threadId, setThreadId] = useQueryState("threadId");

  const finalAssistantId = assistantId?.trim();

  const { getThreads, threads, setThreads, threadsLoading, setThreadsLoading } =
    useThreads();

  // Load threads when assistantId is available
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!finalAssistantId) return;

    setThreadsLoading(true);
    getThreads()
      .then(setThreads)
      .catch((error) => {
        console.error(error);
        setThreads([]); // Set empty array on error to show clean empty state
      })
      .finally(() => setThreadsLoading(false));
  }, [
    finalAssistantId,
    getThreads,
    setThreads,
    setThreadsLoading,
  ]);

  const handleNewChat = () => {
    setThreadId(null);
  };

  const handleToggleChatHistory = () => {
    onChatHistoryOpenChange(!chatHistoryOpen);
  };

  const handleMobileNewChat = () => {
    handleNewChat();
    onChatHistoryOpenChange(false);
  };

  const handleMobileThreadClick = () => {
    onChatHistoryOpenChange(!chatHistoryOpen);
  };

  return (
    <>
      <DesktopSidebar
        threads={threads}
        threadsLoading={threadsLoading}
        chatHistoryOpen={chatHistoryOpen}
        onToggleChatHistory={handleToggleChatHistory}
        onNewChat={handleNewChat}
        onShowGuide={onShowGuide}
      />
      <MobileSidebar
        threads={threads}
        isOpen={chatHistoryOpen && !isLargeScreen}
        onOpenChange={(open) => {
          if (isLargeScreen) return;
          onChatHistoryOpenChange(open);
        }}
        onNewChat={handleMobileNewChat}
        onThreadClick={handleMobileThreadClick}
        onShowGuide={onShowGuide}
      />
    </>
  );
}
