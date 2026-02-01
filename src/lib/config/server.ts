import { ChatConfig } from "./client";
import { fullConfig } from "@/configs";
import { getAllSettings } from "@/lib/services/settings.service";
import type { GlobalSettings } from "@/types/global-settings";

/**
 * Apply global settings from DB to config
 */
function applyGlobalSettings(
  config: typeof fullConfig,
  settings: GlobalSettings
): ChatConfig {
  return {
    ...config,
    branding: {
      ...config.branding,
      // ui.welcomeMessage → branding.description
      description: settings["ui.welcomeMessage"] || config.branding.description,
    },
    buttons: {
      ...config.buttons,
      // ui.chatInputPlaceholder → buttons.chatInputPlaceholder
      chatInputPlaceholder:
        settings["ui.chatInputPlaceholder"] || config.buttons.chatInputPlaceholder,
      // features.enableFileUpload → buttons.enableFileUpload
      enableFileUpload: settings["features.enableFileUpload"] ?? config.buttons.enableFileUpload,
    },
    threads: {
      ...config.threads,
      // features.showHistory → threads.showHistory
      showHistory: settings["features.showHistory"] ?? config.threads.showHistory,
      // features.enableDeletion → threads.enableDeletion
      enableDeletion: settings["features.enableDeletion"] ?? config.threads.enableDeletion,
      // features.autoGenerateTitles → threads.autoGenerateTitles
      autoGenerateTitles: settings["features.autoGenerateTitles"] ?? config.threads.autoGenerateTitles,
    },
  };
}

/**
 * Loads configuration from src/configs on the server side,
 * merged with global settings from the database.
 *
 * @returns The site configuration with DB overrides
 */
export async function loadServerConfig(): Promise<ChatConfig> {
  try {
    // Load global settings from DB
    const settings = await getAllSettings();
    // Merge with static config
    const mergedConfig = applyGlobalSettings(fullConfig, settings);
    return mergedConfig;
  } catch (error) {
    // If DB is unavailable, fall back to static config
    console.error("Failed to load global settings, using defaults:", error);
    return fullConfig as ChatConfig;
  }
}
