"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut, User } from "lucide-react";

export function UserMenu() {
  const { user, isLoading, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground max-w-[120px] truncate">
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
            <p>Sign out</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
