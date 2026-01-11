"use client";

import { Settings as SettingsIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/hooks/useSettings";
import { useThreads } from "@/hooks/useThreads";
import { createClient } from "@/providers/client";
import { getApiKey } from "@/lib/api-key";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { ConnectionList } from "./ConnectionList";

export function SettingsDialog() {
  const { userSettings, updateUserSettings, resetUserSettings } = useSettings();
  const { threads, getThreads, setThreads } = useThreads();
  const [apiUrlParam] = useQueryState("apiUrl");
  const [threadId, setThreadId] = useQueryState("threadId");

  // Get API URL with environment variable fallback
  const envApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;
  const apiUrl = apiUrlParam || envApiUrl;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAllThreads = async () => {
    if (!apiUrl) {
      toast.error("API URL is not configured");
      return;
    }

    // Fetch current threads if not already loaded
    const threadsToDelete = threads.length > 0 ? threads : await getThreads();

    if (threadsToDelete.length === 0) {
      toast.info("No conversations to delete");
      return;
    }

    // Show native confirm dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete all conversation history?\n\n` +
      `All ${threadsToDelete.length} conversation${threadsToDelete.length !== 1 ? 's' : ''} will be permanently deleted.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      const client = createClient(apiUrl, getApiKey() ?? undefined);

      // Delete all threads
      const deletePromises = threadsToDelete.map(thread =>
        client.threads.delete(thread.thread_id)
      );

      await Promise.all(deletePromises);

      // Clear the threads list
      setThreads([]);

      // Clear current thread if it exists
      if (threadId) {
        setThreadId(null);
      }

      toast.success(`Successfully deleted ${threadsToDelete.length} conversation${threadsToDelete.length > 1 ? 's' : ''}`);

      // Reload the page to reset the chat interface
      window.location.reload();
    } catch (err) {
      console.error("Error deleting threads:", err);
      toast.error("Failed to delete all conversations");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 hover:bg-accent cursor-pointer"
        >
          <SettingsIcon className="size-5" />
          <span>설정</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">Settings</DialogTitle>
          <DialogDescription>
            Customize your chat experience
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Font Family Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Appearance</h3>
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="font-family">Font Style</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.fontFamily === "sans" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ fontFamily: "sans" })
                    }
                    className="flex-1"
                  >
                    Sans Serif
                  </Button>
                  <Button
                    variant={
                      userSettings.fontFamily === "serif" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ fontFamily: "serif" })
                    }
                    className="flex-1"
                  >
                    Serif
                  </Button>
                  <Button
                    variant={
                      userSettings.fontFamily === "mono" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ fontFamily: "mono" })
                    }
                    className="flex-1"
                  >
                    Monospace
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="font-size">Font Size</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.fontSize === "small" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ fontSize: "small" })
                    }
                    className="flex-1"
                  >
                    Small
                  </Button>
                  <Button
                    variant={
                      userSettings.fontSize === "medium" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ fontSize: "medium" })
                    }
                    className="flex-1"
                  >
                    Medium
                  </Button>
                  <Button
                    variant={
                      userSettings.fontSize === "large" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ fontSize: "large" })
                    }
                    className="flex-1"
                  >
                    Large
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color-scheme">Color Scheme</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.colorScheme === "light" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ colorScheme: "light" })
                    }
                    className="flex-1"
                  >
                    Light
                  </Button>
                  <Button
                    variant={
                      userSettings.colorScheme === "dark" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ colorScheme: "dark" })
                    }
                    className="flex-1"
                  >
                    Dark
                  </Button>
                  <Button
                    variant={
                      userSettings.colorScheme === "auto" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ colorScheme: "auto" })
                    }
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
            <h3 className="text-lg font-semibold">UI Behavior</h3>
            <div className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-collapse">Auto-collapse Tool Calls</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically collapse tool call details after response completes
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
                <Label htmlFor="chat-width">Chat Width</Label>
                <div className="flex gap-2">
                  <Button
                    variant={
                      userSettings.chatWidth === "default" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ chatWidth: "default" })
                    }
                    className="flex-1"
                  >
                    Default
                  </Button>
                  <Button
                    variant={
                      userSettings.chatWidth === "wide" ? "default" : "outline"
                    }
                    onClick={() =>
                      updateUserSettings({ chatWidth: "wide" })
                    }
                    className="flex-1"
                  >
                    Wide
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Connections Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Connections</h3>
            <ConnectionList />
          </div>

          {/* Delete All Conversations Section */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
            <div className="rounded-lg border border-destructive/50 p-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Delete All Conversations</Label>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete all conversation history. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAllThreads}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeleting ? "Deleting..." : "Delete All"}
                </Button>
              </div>
            </div>
          </div>

          {/* Reset Section */}
          <div className="flex justify-end pt-4">
            <Button
              variant="outline"
              onClick={resetUserSettings}
            >
              Reset to Defaults
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}