import { Thread } from "@langchain/langgraph-sdk";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PanelRightOpen, PanelRightClose, BookOpen, Settings, Users, Shield } from "lucide-react";
import { NewChatButton } from "./NewChatButton";
import { ThreadList } from "./ThreadList";
import { ThreadHistoryLoading } from "./ThreadHistoryLoading";
import { ICON_SIZE_SM } from "../constants";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { UserMenu } from "@/components/auth/UserMenu";
import { useAuth } from "@/hooks/useAuth";
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
    <div className="shadow-inner-right h-screen w-[300px] shrink-0 flex-col items-stretch justify-start border-r-[1px] border-border flex">
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
      <div className="px-3 mb-2">
        <NewChatButton onClick={onNewChat} />
      </div>

      {/* Guide button */}
      {onShowGuide && (
        <div className="px-3">
          <div
            className="h-10 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent"
            onClick={onShowGuide}
          >
            <BookOpen className={ICON_SIZE_SM} />
            <span className="text-sm font-medium">사용 가이드</span>
          </div>
        </div>
      )}

      {/* Admin navigation (only for admins) */}
      {userIsAdmin && (
        <div className="px-3 mt-4">
          <p className="text-xs font-medium text-muted-foreground px-3 mb-2">관리자</p>
          <Link href="/admin/users">
            <div
              className={cn(
                "h-10 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent",
                pathname === "/admin/users" && "bg-accent"
              )}
            >
              <Users className={ICON_SIZE_SM} />
              <span className="text-sm font-medium">사용자 관리</span>
            </div>
          </Link>
          <Link href="/admin/approvals">
            <div
              className={cn(
                "h-10 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent",
                pathname === "/admin/approvals" && "bg-accent"
              )}
            >
              <Shield className={ICON_SIZE_SM} />
              <span className="text-sm font-medium">가입 승인</span>
            </div>
          </Link>
          <Link href="/admin/settings">
            <div
              className={cn(
                "h-10 flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 transition-colors hover:bg-accent",
                pathname === "/admin/settings" && "bg-accent"
              )}
            >
              <Settings className={ICON_SIZE_SM} />
              <span className="text-sm font-medium">설정</span>
            </div>
          </Link>
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

      <div className="border-t border-border p-4 space-y-3">
        <UserMenu />
        <SettingsDialog />
      </div>
    </div>
  );
}
