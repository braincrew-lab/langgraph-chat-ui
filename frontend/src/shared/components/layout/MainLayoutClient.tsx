"use client";

import React, { useState, useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { motion } from "framer-motion";
import { Toaster } from "@/shared/components/ui/sonner";
import { ChatConfig } from "@/lib/config/client";
import { SettingsProvider } from "@/providers/Settings";
import type { GlobalSettings } from "@/types/global-settings";
import { ThreadProvider } from "@/providers/Thread";
import type { ConnectionConfig } from "@/providers/Stream";
import { useThreads } from "@/shared/hooks/useThreads";
import { useSettings } from "@/shared/hooks/useSettings";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { DesktopSidebar } from "@/features/history/components/DesktopSidebar";
import { MobileSidebar } from "@/features/history/components/MobileSidebar";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { PanelRightOpen, PanelRightClose, PanelRight } from "lucide-react";
import { GitHubSVG } from "@/shared/components/icons/github";
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
  globalSettings: GlobalSettings;
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
  const useUnifiedDarkSurface = isOnChatPage || isOnAdminPage;
  const showHeaderLogo = isOnAdminPage || !!threadId; // Show logo on admin pages or when chat started

  // Sidebar state from settings (persisted)
  const chatHistoryOpen = userSettings.chatHistoryOpen;
  const setChatHistoryOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue =
        typeof value === "function" ? value(chatHistoryOpen) : value;
      updateUserSettings({ chatHistoryOpen: newValue });
    },
    [chatHistoryOpen, updateUserSettings],
  );

  // Tracing panel state from settings (persisted)
  const tracingPanelOpen = userSettings.tracingPanelOpen;
  const setTracingPanelOpen = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const newValue =
        typeof value === "function" ? value(tracingPanelOpen) : value;
      updateUserSettings({ tracingPanelOpen: newValue });
    },
    [tracingPanelOpen, updateUserSettings],
  );

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
            className="border-border bg-sidebar absolute z-20 h-full overflow-hidden border-r"
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
              className="relative flex h-full flex-col"
              style={{ width: UI.CHAT_SIDEBAR_WIDTH }}
            >
              <div className="flex-1 overflow-hidden">
                <DesktopSidebar
                  threads={threads}
                  threadsLoading={threadsLoading}
                  onNewChat={handleNewChat}
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
      />

      {/* Main Content Area */}
      <main
        className={cn(
          "flex flex-1 flex-col overflow-hidden transition-all",
          isLargeScreen ? "duration-300" : "duration-0",
        )}
        style={{
          marginLeft:
            config.threads.showHistory && chatHistoryOpen
              ? isLargeScreen
                ? UI.CHAT_SIDEBAR_WIDTH
                : 0
              : 0,
          marginRight:
            isOnChatPage && tracingPanelOpen
              ? isLargeScreen
                ? UI.TRACING_SIDEBAR_WIDTH
                : 0
              : 0,
        }}
      >
        {/* Shared Header */}
        <header
          className={cn(
            "relative flex flex-shrink-0 items-center justify-between gap-3 p-4",
            useUnifiedDarkSurface ? "bg-card" : "bg-background",
          )}
        >
          <div className="flex items-center gap-3">
            {config.threads.showHistory &&
              (isLargeScreen || !chatHistoryOpen) && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleToggleChatHistory}
                  className="h-10 w-10"
                  aria-label={
                    chatHistoryOpen ? "Close sidebar" : "Open sidebar"
                  }
                >
                  {chatHistoryOpen ? (
                    <PanelRightOpen className="size-[22px]" />
                  ) : (
                    <PanelRightClose className="size-[22px]" />
                  )}
                </Button>
              )}
            {showHeaderLogo && (
              <button
                className="flex cursor-pointer items-center gap-2 rounded-md focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none"
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href="https://github.com/teddynote-lab/langgraph-chat-ui"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:bg-accent focus-visible:ring-ring flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    aria-label="Open GitHub repository"
                  >
                    <GitHubSVG
                      width="24"
                      height="24"
                    />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Open GitHub repo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Tracing panel toggle - only on chat pages when LangSmith is configured */}
            {isOnChatPage && config.langsmithEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTracingPanelOpen((prev) => !prev)}
                      className={cn("h-10 w-10", tracingPanelOpen && "bg-accent")}
                    >
                      <PanelRight className="size-[22px]" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {tracingPanelOpen
                        ? "Close tracing panel"
                        : "Open tracing panel"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Header bottom fade */}
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-full h-5 bg-gradient-to-b",
              useUnifiedDarkSurface
                ? "from-card to-transparent"
                : "from-background/95 to-transparent",
            )}
          />
        </header>

        {/* Page Content */}
        <div
          className={cn("flex-1 overflow-hidden", isOnChatPage && "bg-card")}
        >
          <TracingPanelContext.Provider
            value={{ isOpen: tracingPanelOpen, setIsOpen: setTracingPanelOpen }}
          >
            {children}
          </TracingPanelContext.Provider>
        </div>
      </main>

    </div>
  );
}

export function MainLayoutClient({
  children,
  initialConfig,
  initialConnection,
  globalSettings,
}: MainLayoutClientProps) {
  // Use connection as key to force remount when connection changes
  const connectionKey = `${initialConnection.apiUrl}:${initialConnection.assistantId}`;

  return (
    <React.Suspense fallback={<div></div>}>
      <Toaster />
      <SettingsProvider
        initialConfig={initialConfig}
        initialGlobalSettings={globalSettings}
      >
        <ThreadProvider
          key={connectionKey}
          connection={initialConnection}
        >
          <MainLayoutContent assistantId={initialConnection.assistantId}>
            {children}
          </MainLayoutContent>
        </ThreadProvider>
      </SettingsProvider>
    </React.Suspense>
  );
}
