import { Thread } from "@langchain/langgraph-sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import {
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
          <div
            className="hover:bg-accent flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors"
            onClick={onShowGuide}
          >
            <BookOpen className={ICON_SIZE_SM} />
            <span className="text-sm font-medium">사용 가이드</span>
          </div>
        </div>
      )}

      {/* Admin navigation (only for admins) */}
      {userIsAdmin && (
        <div className="mt-4 px-3">
          <p className="text-muted-foreground mb-2 px-3 text-xs font-medium">
            관리자
          </p>
          <nav className="space-y-2">
            <Link
              href="/admin/users"
              className={cn(
                "hover:bg-accent flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors",
                pathname === "/admin/users" && "bg-accent",
              )}
            >
              <Users className={ICON_SIZE_SM} />
              <span className="text-sm font-medium">사용자 관리</span>
            </Link>
            <Link
              href="/admin/approvals"
              className={cn(
                "hover:bg-accent flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors",
                pathname === "/admin/approvals" && "bg-accent",
              )}
            >
              <Shield className={ICON_SIZE_SM} />
              <span className="text-sm font-medium">가입 승인</span>
            </Link>
            <Link
              href="/admin/settings"
              className={cn(
                "hover:bg-accent flex h-10 w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors",
                pathname === "/admin/settings" && "bg-accent",
              )}
            >
              <Settings className={ICON_SIZE_SM} />
              <span className="text-sm font-medium">설정</span>
            </Link>
          </nav>
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

      <div className="border-border space-y-3 border-t bg-transparent p-4">
        <UserMenu />
        <SettingsDialog />
      </div>
    </div>
  );
}
