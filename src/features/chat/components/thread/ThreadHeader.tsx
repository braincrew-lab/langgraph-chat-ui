"use client";

import { motion } from "framer-motion";
import { Button } from "@/shared/components/ui/button";
import {
  PanelRightOpen,
  PanelRightClose,
  PanelRight,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { OpenGitHubRepo } from "./ThreadScrollUtils";
import { ChatConfig } from "@/lib/config/client";

interface ThreadHeaderProps {
  config: ChatConfig;
  chatStarted: boolean;
  chatHistoryOpen: boolean;
  setChatHistoryOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  isLargeScreen: boolean;
  onLogoClick: () => void;
}

export function ThreadHeader({
  config,
  chatStarted,
  chatHistoryOpen,
  setChatHistoryOpen,
  sidebarOpen,
  setSidebarOpen,
  isLargeScreen,
  onLogoClick,
}: ThreadHeaderProps) {
  if (!chatStarted) {
    return (
      <div className="absolute top-0 left-0 z-10 flex w-full items-center justify-between gap-3 p-4">
        <div>
          {config.threads.showHistory && (!chatHistoryOpen || !isLargeScreen) && (
            <Button
              className="hover:bg-accent cursor-pointer"
              variant="ghost"
              onClick={() => setChatHistoryOpen((p) => !p)}
            >
              {chatHistoryOpen ? (
                <PanelRightOpen className="size-5" />
              ) : (
                <PanelRightClose className="size-5" />
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen((prev) => !prev)}
                  className={cn(
                    "h-9 w-9",
                    sidebarOpen && "bg-accent"
                  )}
                >
                  <PanelRight className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{sidebarOpen ? "Close tracing panel" : "Open tracing panel"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <OpenGitHubRepo />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 z-10 w-full flex items-center justify-between gap-3 p-4">
      <div className="relative flex items-center justify-start gap-2">
        <div className="absolute left-0 z-10">
          {config.threads.showHistory && (!chatHistoryOpen || !isLargeScreen) && (
            <Button
              className="hover:bg-accent"
              variant="ghost"
              onClick={() => setChatHistoryOpen((p) => !p)}
            >
              {chatHistoryOpen ? (
                <PanelRightOpen className="size-5" />
              ) : (
                <PanelRightClose className="size-5" />
              )}
            </Button>
          )}
        </div>
        <motion.button
          className="flex cursor-pointer items-center gap-2 ml-2"
          onClick={onLogoClick}
          animate={{
            translateX: config.threads.showHistory && !chatHistoryOpen ? 48 : 0,
          }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 30,
          }}
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
        </motion.button>
      </div>

      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen((prev) => !prev)}
                className={cn(
                  "h-9 w-9",
                  sidebarOpen && "bg-accent"
                )}
              >
                <PanelRight className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>{sidebarOpen ? "Close tracing panel" : "Open tracing panel"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <OpenGitHubRepo />
      </div>

      <div className="from-background to-background/0 absolute inset-x-0 top-full h-5 bg-gradient-to-b" />
    </div>
  );
}
