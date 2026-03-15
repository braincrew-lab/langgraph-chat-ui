import { fullConfig } from "@/configs";

export interface ChatConfig {
  meta: {
    title: string;
    description: string;
    favicon?: string;
  };
  branding: {
    appName: string;
    logoPath: string;
    logoWidth: number;
    logoHeight: number;
    description?: string;
    chatOpeners?: string[];
    fullDescription?: string;
  };
  buttons: {
    enableFileUpload: boolean;
    chatInputPlaceholder: string;
  };
  threads: {
    showHistory: boolean;
    enableDeletion: boolean;
    enableTitleEdit: boolean;
    autoGenerateTitles: boolean;
    sidebarOpenByDefault: boolean;
  };
  theme: {
    fontFamily: "sans" | "serif" | "mono";
    fontSize: "small" | "medium" | "large";
    colorScheme: "light" | "dark" | "auto";
  };
  ui: {
    autoCollapseToolCalls: boolean;
    chatWidth: "default" | "wide";
    chatHistoryOpen: boolean;
    tracingPanelOpen: boolean;
  };
  /** Whether LangSmith tracing is available (env vars configured) */
  langsmithEnabled: boolean;
}

// Default configuration (from src/configs)
export const defaultConfig: ChatConfig = fullConfig as ChatConfig;

// Load configuration from src/configs
export async function loadConfig(): Promise<ChatConfig> {
  return fullConfig as ChatConfig;
}
