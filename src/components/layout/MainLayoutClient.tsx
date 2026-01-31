"use client";

import React, { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { motion } from "framer-motion";
import { Toaster } from "@/components/ui/sonner";
import { ChatConfig } from "@/lib/config";
import { SettingsProvider } from "@/providers/Settings";
import { ThreadProvider } from "@/providers/Thread";
import type { ConnectionConfig } from "@/providers/Stream";
import { useThreads } from "@/hooks/useThreads";
import { useSettings } from "@/hooks/useSettings";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { DesktopSidebar } from "@/components/thread/history/components/DesktopSidebar";
import { MobileSidebar } from "@/components/thread/history/components/MobileSidebar";
import { FullDescriptionModal } from "@/components/thread/FullDescriptionModal";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PanelRightOpen, PanelRightClose, PanelRight } from "lucide-react";
import { GitHubSVG } from "@/components/icons/github";
import { UI } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Context for tracing panel state (used by chat components)
export const TracingPanelContext = React.createContext<{
  isOpen: boolean;
  setIsOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
} | null>(null);

interface MainLayoutClientProps {
  children: React.ReactNode;
  initialConfig: ChatConfig;
  initialConnection: ConnectionConfig;
}

interface MainLayoutContentProps {
  children: React.ReactNode;
  assistantId: string;
}

function MainLayoutContent({ children, assistantId }: MainLayoutContentProps) {
  const { config, userSettings, updateUserSettings } = useSettings();
  const router = useRouter();
  const isLargeScreen = useMediaQuery("(min-width: 1024px)");
  const [threadId, setThreadId] = useQueryState("threadId");
  const pathname = usePathname();
  const isOnAdminPage = pathname?.startsWith("/admin");
  const isOnChatPage = pathname === "/" || pathname === "";
  const showHeaderLogo = isOnAdminPage || !!threadId; // Show logo on admin pages or when chat started

  // Sidebar state from settings (persisted)
  const chatHistoryOpen = userSettings.chatHistoryOpen;
  const setChatHistoryOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === "function" ? value(chatHistoryOpen) : value;
      updateUserSettings({ chatHistoryOpen: newValue });
    },
    [chatHistoryOpen, updateUserSettings]
  );

  // Tracing panel state from settings (persisted)
  const tracingPanelOpen = userSettings.tracingPanelOpen;
  const setTracingPanelOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue = typeof value === "function" ? value(tracingPanelOpen) : value;
      updateUserSettings({ tracingPanelOpen: newValue });
    },
    [tracingPanelOpen, updateUserSettings]
  );

  // Guide modal state
  const [fullDescriptionOpen, setFullDescriptionOpen] = useState(false);

  const finalAssistantId = assistantId?.trim() || "";

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
        setThreads([]);
      })
      .finally(() => setThreadsLoading(false));
  }, [finalAssistantId, getThreads, setThreads, setThreadsLoading]);

  const handleNewChat = useCallback(() => {
    if (isOnAdminPage) {
      router.push("/");
    } else {
      setThreadId(null);
    }
  }, [setThreadId, isOnAdminPage, router]);

  const handleToggleChatHistory = useCallback(() => {
    setChatHistoryOpen((prev) => !prev);
  }, [setChatHistoryOpen]);

  const handleMobileNewChat = useCallback(() => {
    if (isOnAdminPage) {
      router.push("/");
    } else {
      setThreadId(null);
    }
    setChatHistoryOpen(false);
  }, [setThreadId, setChatHistoryOpen, isOnAdminPage, router]);

  const handleMobileThreadClick = useCallback(() => {
    setChatHistoryOpen((prev) => !prev);
  }, [setChatHistoryOpen]);

  const handleShowGuide = useCallback(() => {
    setFullDescriptionOpen(true);
  }, []);

  const handleLogoClick = useCallback(() => {
    if (isOnAdminPage) {
      router.push("/");
    } else {
      setThreadId(null);
    }
  }, [setThreadId, isOnAdminPage, router]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Desktop Sidebar */}
      {config.threads.showHistory && (
        <div className="relative hidden lg:flex">
          <motion.div
            className="absolute z-20 h-full overflow-hidden border-r border-border bg-sidebar"
            style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            initial={false}
            animate={{ x: chatHistoryOpen ? 0 : -UI.CHAT_SIDEBAR_WIDTH }}
            transition={
              isLargeScreen
                ? { type: "spring", stiffness: 300, damping: 30 }
                : { duration: 0 }
            }
          >
            <div
              className="relative h-full flex flex-col"
              style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            >
              <div className="flex-1 overflow-hidden">
                <DesktopSidebar
                  threads={threads}
                  threadsLoading={threadsLoading}
                  chatHistoryOpen={chatHistoryOpen}
                  onToggleChatHistory={handleToggleChatHistory}
                  onNewChat={handleNewChat}
                  onShowGuide={handleShowGuide}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Mobile Sidebar */}
      <MobileSidebar
        threads={threads}
        isOpen={chatHistoryOpen && !isLargeScreen}
        onOpenChange={(open) => {
          if (isLargeScreen) return;
          setChatHistoryOpen(open);
        }}
        onNewChat={handleMobileNewChat}
        onThreadClick={handleMobileThreadClick}
        onShowGuide={handleShowGuide}
      />

      {/* Main Content Area */}
      <main
        className={cn(
          "flex-1 flex flex-col overflow-hidden transition-all",
          isLargeScreen ? "duration-300" : "duration-0"
        )}
        style={{
          marginLeft:
            config.threads.showHistory && chatHistoryOpen
              ? isLargeScreen
                ? UI.CHAT_SIDEBAR_WIDTH
                : 0
              : 0,
        }}
      >
        {/* Shared Header */}
        <header className="relative flex-shrink-0 flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2">
            {config.threads.showHistory && (!chatHistoryOpen || !isLargeScreen) && (
              <Button
                className="hover:bg-accent"
                variant="ghost"
                onClick={handleToggleChatHistory}
                aria-label={chatHistoryOpen ? "Close sidebar" : "Open sidebar"}
              >
                {chatHistoryOpen ? (
                  <PanelRightOpen className="size-5" />
                ) : (
                  <PanelRightClose className="size-5" />
                )}
              </Button>
            )}
            {showHeaderLogo && (
              <button
                className="flex items-center gap-2 cursor-pointer"
                onClick={handleLogoClick}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.branding.logoPath}
                  alt="Logo"
                  width={config.branding.logoWidth}
                  height={config.branding.logoHeight}
                />
                <span className="text-xl font-semibold tracking-tight">
                  {config.branding.appName}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Tracing panel toggle - only on chat pages */}
            {isOnChatPage && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTracingPanelOpen((prev) => !prev)}
                      className={cn(
                        "h-9 w-9",
                        tracingPanelOpen && "bg-accent"
                      )}
                    >
                      <PanelRight className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{tracingPanelOpen ? "Close tracing panel" : "Open tracing panel"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/teddylee777/agent-chat-ui"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-9 w-9 rounded-md hover:bg-accent transition-colors"
                    aria-label="Open GitHub repository"
                  >
                    <GitHubSVG width="24" height="24" />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Open GitHub repo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {/* Gradient fade */}
          <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b pointer-events-none" />
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          <TracingPanelContext.Provider value={{ isOpen: tracingPanelOpen, setIsOpen: setTracingPanelOpen }}>
            {children}
          </TracingPanelContext.Provider>
        </div>
      </main>

      {/* Full Description Modal */}
      <FullDescriptionModal
        open={fullDescriptionOpen}
        onOpenChange={setFullDescriptionOpen}
      />
    </div>
  );
}

export function MainLayoutClient({
  children,
  initialConfig,
  initialConnection,
}: MainLayoutClientProps) {
  // Use connection as key to force remount when connection changes
  const connectionKey = `${initialConnection.apiUrl}:${initialConnection.assistantId}`;

  return (
    <React.Suspense fallback={<div></div>}>
      <Toaster />
      <SettingsProvider initialConfig={initialConfig}>
        <ThreadProvider key={connectionKey} connection={initialConnection}>
          <MainLayoutContent assistantId={initialConnection.assistantId}>
            {children}
          </MainLayoutContent>
        </ThreadProvider>
      </SettingsProvider>
    </React.Suspense>
  );
}
