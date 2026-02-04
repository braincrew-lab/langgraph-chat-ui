export const siteConfig = {
  meta: {
    title: "TeddyNote Chat",
    description: "AI 어시스턴트와 대화하세요",
    favicon: "", // 빈값이면 logoPath 사용
  },
  branding: {
    appName: "TeddyNote Chat",
    logoPath: "/logo.png",
    logoWidth: 28,
    logoHeight: 28,
    description: "테디노트 챗봇에게 무엇이든 물어보세요.",
    fullDescription: "/full-description.md",
  },
  buttons: {
    enableFileUpload: true,
    chatInputPlaceholder: "궁금한 내용을 물어보세요.",
  },
  threads: {
    showHistory: true,
    enableDeletion: true,
    enableTitleEdit: true,
    autoGenerateTitles: true,
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
