"use client";

import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useSettings } from "@/shared/hooks/useSettings";
import { useThreads } from "@/shared/hooks/useThreads";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { ConnectionList } from "./ConnectionList";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { clearConnectionCookiesAction } from "@/app/actions";
import { useTranslations } from "next-intl";

export function SettingsDialog() {
  const {
    userSettings,
    updateUserSettings,
    resetUserSettings,
    globalSettings,
  } = useSettings();
  const { threads, getThreads, setThreads, client } = useThreads();
  const router = useRouter();
  const [threadId, setThreadId] = useQueryState("threadId");
  const t = useTranslations("settings");
  const tc = useTranslations("common");

  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Reset all settings to server-side defaults
  const handleResetToDefaults = async () => {
    const confirmed = window.confirm(t("resetConfirm"));

    if (!confirmed) return;

    setIsResetting(true);
    try {
      // Reset user settings (localStorage)
      resetUserSettings();

      // Clear connection cookies (server-side)
      await clearConnectionCookiesAction();

      // Clear localStorage connection data
      if (typeof window !== "undefined") {
        localStorage.removeItem("lg:connections");
        localStorage.removeItem("lg:chat:apiKey");
      }

      toast.success(t("resetSuccess"));

      // Refresh to apply changes
      router.refresh();
      window.location.href = window.location.pathname;
    } catch (error) {
      console.error("Error resetting settings:", error);
      toast.error(t("resetError"));
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteAllThreads = async () => {
    if (!client) {
      toast.error(t("apiClientError"));
      return;
    }

    // Fetch current threads if not already loaded
    const threadsToDelete = threads.length > 0 ? threads : await getThreads();

    if (threadsToDelete.length === 0) {
      toast.info(t("noConversations"));
      return;
    }

    // Show native confirm dialog
    const confirmed = window.confirm(
      t("deleteConfirm", { count: threadsToDelete.length }),
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      // Delete all threads
      const deletePromises = threadsToDelete.map((thread) =>
        client.threads.delete(thread.thread_id),
      );

      await Promise.all(deletePromises);

      // Clear the threads list
      setThreads([]);

      // Clear current thread if it exists
      if (threadId) {
        setThreadId(null);
      }

      toast.success(t("deleteSuccess", { count: threadsToDelete.length }));

      // Reload the page to reset the chat interface
      window.location.reload();
    } catch (err) {
      console.error("Error deleting threads:", err);
      toast.error(t("deleteError"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="hover:bg-accent w-full cursor-pointer justify-start gap-2"
        >
          <SettingsIcon className="size-5" />
          <span>{tc("settings")}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Language Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{t("language")}</h3>
            <div className="space-y-4 rounded-lg border p-4">
              <LanguageSwitcher />
            </div>
          </div>

          {/* Font Family Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{t("appearance")}</h3>
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="font-family">{t("fontStyle")}</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.fontFamily === "sans" ? "default" : "outline"
                    }
                    onClick={() => updateUserSettings({ fontFamily: "sans" })}
                    className="flex-1"
                  >
                    Sans Serif
                  </Button>
                  <Button
                    variant={
                      userSettings.fontFamily === "serif"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => updateUserSettings({ fontFamily: "serif" })}
                    className="flex-1"
                  >
                    Serif
                  </Button>
                  <Button
                    variant={
                      userSettings.fontFamily === "mono" ? "default" : "outline"
                    }
                    onClick={() => updateUserSettings({ fontFamily: "mono" })}
                    className="flex-1"
                  >
                    Monospace
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size">{t("fontSize")}</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.fontSize === "small" ? "default" : "outline"
                    }
                    onClick={() => updateUserSettings({ fontSize: "small" })}
                    className="flex-1"
                  >
                    Small
                  </Button>
                  <Button
                    variant={
                      userSettings.fontSize === "medium" ? "default" : "outline"
                    }
                    onClick={() => updateUserSettings({ fontSize: "medium" })}
                    className="flex-1"
                  >
                    Medium
                  </Button>
                  <Button
                    variant={
                      userSettings.fontSize === "large" ? "default" : "outline"
                    }
                    onClick={() => updateUserSettings({ fontSize: "large" })}
                    className="flex-1"
                  >
                    Large
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color-scheme">{t("colorScheme")}</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.colorScheme === "light"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => updateUserSettings({ colorScheme: "light" })}
                    className="flex-1"
                  >
                    Light
                  </Button>
                  <Button
                    variant={
                      userSettings.colorScheme === "dark"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => updateUserSettings({ colorScheme: "dark" })}
                    className="flex-1"
                  >
                    Dark
                  </Button>
                  <Button
                    variant={
                      userSettings.colorScheme === "auto"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => updateUserSettings({ colorScheme: "auto" })}
                    className="flex-1"
                  >
                    Auto
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* UI Behavior Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{t("uiBehavior")}</h3>
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-collapse">{t("autoCollapse")}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t("autoCollapseDesc")}
                  </p>
                </div>
                <Switch
                  id="auto-collapse"
                  checked={userSettings.autoCollapseToolCalls}
                  onCheckedChange={(checked) =>
                    updateUserSettings({ autoCollapseToolCalls: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chat-width">{t("chatWidth")}</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.chatWidth === "default"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => updateUserSettings({ chatWidth: "default" })}
                    className="flex-1"
                  >
                    Default
                  </Button>
                  <Button
                    variant={
                      userSettings.chatWidth === "wide" ? "default" : "outline"
                    }
                    onClick={() => updateUserSettings({ chatWidth: "wide" })}
                    className="flex-1"
                  >
                    Wide
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Connections Section - only show if connection selection is enabled */}
          {globalSettings["features.enableConnectionSelection"] && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">{t("connections")}</h3>
              <ConnectionList />
            </div>
          )}

          {/* Delete All Conversations Section */}
          <div className="space-y-3">
            <h3 className="text-destructive text-lg font-semibold">
              {t("dangerZone")}
            </h3>
            <div className="border-destructive/50 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t("deleteAll")}</Label>
                  <p className="text-muted-foreground text-sm">
                    {t("deleteAllDesc")}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAllThreads}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? t("deleting") : t("deleteButton")}
                </Button>
              </div>
            </div>
          </div>

          {/* Reset Section */}
          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              onClick={handleResetToDefaults}
              disabled={isResetting}
            >
              {isResetting ? t("resetting") : t("resetToDefaults")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
