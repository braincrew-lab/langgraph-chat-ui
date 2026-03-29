export const siteConfig = {
  meta: {
    title: "LangGraph Chat UI",
    description: "A production-ready chat interface for LangGraph agents",
    favicon: "", // 빈값이면 logoPath 사용
  },
  branding: {
    appName: "LangGraph Chat UI",
    logoPath: "/logo.svg",
    logoWidth: 28,
    logoHeight: 28,
    description: "Ask your LangGraph agent anything.",
  },
  buttons: {
    enableFileUpload: true,
    fileUploadMode: "base64" as const,
    chatInputPlaceholder: "Ask anything...",
  },
  threads: {
    showHistory: true,
    enableDeletion: true,
    enableTitleEdit: true,
    sidebarOpenByDefault: true,
  },
  theme: {
    fontFamily: "sans" as const,
    fontSize: "medium" as const,
    colorScheme: "light" as const,
  },
  ui: {
    autoCollapseToolCalls: false,
    chatWidth: "default" as const,
    chatHistoryOpen: false,
    tracingPanelOpen: false,
  },
} as const;
