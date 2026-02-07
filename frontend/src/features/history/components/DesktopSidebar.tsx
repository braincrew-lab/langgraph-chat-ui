import { Thread } from "@langchain/langgraph-sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import {
  LayoutDashboard,
  PanelRightOpen,
  PanelRightClose,
  BookOpen,
  Settings,
  Users,
  Shield,
} from "lucide-react";
import { NewChatButton } from "./NewChatButton";
import { ThreadList } from "./ThreadList";
import { ThreadHistoryLoading } from "./ThreadHistoryLoading";
import { ICON_SIZE_SM } from "../constants";
import { SettingsDialog } from "@/shared/components/settings/SettingsDialog";
import { UserMenu } from "@/features/auth/components/UserMenu";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { isAdmin } from "@/types/auth-mode";
import type { UserRole } from "@/types/auth-mode";
import { cn } from "@/lib/utils";

interface DesktopSidebarProps {
  threads: Thread[];
  threadsLoading: boolean;
  chatHistoryOpen: boolean;
  onToggleChatHistory: () => void;
  onNewChat: () => void;
  onShowGuide?: () => void;
}

export function DesktopSidebar({
  threads,
  threadsLoading,
  chatHistoryOpen,
  onToggleChatHistory,
  onNewChat,
  onShowGuide,
}: DesktopSidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const userIsAdmin = user && isAdmin(user.role as UserRole);

  return (
    <div className="shadow-inner-right border-border flex h-screen w-[300px] shrink-0 flex-col items-stretch justify-start border-r-[1px]">
      {/* Header with collapse button on right */}
      <div className="flex w-full items-center justify-end px-4 pt-1.5">
        <Button
          size="icon"
          className="hover:bg-accent"
          variant="ghost"
          onClick={onToggleChatHistory}
          aria-label={chatHistoryOpen ? "사이드바 접기" : "사이드바 펼치기"}
        >
          {chatHistoryOpen ? (
            <PanelRightOpen className="size-5" />
          ) : (
            <PanelRightClose className="size-5" />
          )}
        </Button>
      </div>

      {/* New Chat button */}
      <div className="mb-2 px-3">
        <NewChatButton onClick={onNewChat} />
      </div>

      {/* Guide button */}
      {onShowGuide && (
        <div className="px-3">
          <button
            type="button"
            className="hover:bg-accent focus-visible:ring-ring flex h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
            onClick={onShowGuide}
          >
            <BookOpen className={ICON_SIZE_SM} />
            <span className="text-sm font-medium">사용 가이드</span>
          </button>
        </div>
      )}

      {/* Admin navigation (only for admins) */}
      {userIsAdmin && (
        <div className="mt-4 px-3">
          <div className="border-border/60 bg-muted/35 rounded-lg border p-2">
            <p className="text-muted-foreground mb-2 px-2 text-xs font-medium">
              관리자
            </p>
            <nav className="space-y-1">
              <Link
                href="/admin"
                className={cn(
                  "hover:bg-accent focus-visible:ring-ring flex h-10 w-full items-center gap-2 rounded-md px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  pathname === "/admin"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <LayoutDashboard className={ICON_SIZE_SM} />
                <span className="text-sm font-medium">대시보드</span>
              </Link>
              <Link
                href="/admin/users"
                className={cn(
                  "hover:bg-accent focus-visible:ring-ring flex h-10 w-full items-center gap-2 rounded-md px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  pathname === "/admin/users"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Users className={ICON_SIZE_SM} />
                <span className="text-sm font-medium">사용자 관리</span>
              </Link>
              <Link
                href="/admin/approvals"
                className={cn(
                  "hover:bg-accent focus-visible:ring-ring flex h-10 w-full items-center gap-2 rounded-md px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  pathname === "/admin/approvals"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Shield className={ICON_SIZE_SM} />
                <span className="text-sm font-medium">가입 승인</span>
              </Link>
              <Link
                href="/admin/settings"
                className={cn(
                  "hover:bg-accent focus-visible:ring-ring flex h-10 w-full items-center gap-2 rounded-md px-3 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  pathname === "/admin/settings"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                <Settings className={ICON_SIZE_SM} />
                <span className="text-sm font-medium">설정</span>
              </Link>
            </nav>
          </div>
        </div>
      )}

      {/* Separator before thread list */}
      <Separator className="my-4" />

      {/* Thread list */}
      <div className="flex-1 overflow-hidden">
        {threadsLoading ? (
          <ThreadHistoryLoading />
        ) : (
          <ThreadList threads={threads} />
        )}
      </div>

      <div className="border-border space-y-3 border-t bg-transparent px-3 py-4">
        <UserMenu />
        <SettingsDialog />
      </div>
    </div>
  );
}
