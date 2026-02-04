"use client";

import { useAuth } from "@/features/auth/hooks/useAuth";
import { Button } from "@/shared/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return <div className="bg-muted h-9 w-9 animate-pulse rounded-full" />;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center justify-between px-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground max-w-[160px] truncate text-sm">
                {user.name || user.email}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{user.email}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut()}
              className="h-8 w-8"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>로그아웃</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
