/**
 * Global settings types
 * Defines all configurable settings in the application
 * These settings can be modified by admins in the dashboard
 */

export type SettingCategory = "auth" | "ui" | "features" | "branding";

/**
 * All available setting keys grouped by category
 * NOTE: Keep these in sync with what's actually used in the app
 */
export interface GlobalSettings {
  // Auth settings
  "auth.registrationPolicy": "open" | "approval"; // 회원가입 정책
  "auth.allowRegistration": boolean; // 회원가입 허용 여부

  // UI settings (matches site.ts structure)
  "ui.welcomeMessage": string; // 웰컴 메시지
  "ui.chatInputPlaceholder": string; // 채팅 입력 플레이스홀더

  // Feature flags (matches site.ts structure)
  "features.enableFileUpload": boolean; // 파일 업로드 허용
  "features.showHistory": boolean; // 채팅 히스토리 표시
  "features.enableDeletion": boolean; // 스레드 삭제 허용
  "features.autoGenerateTitles": boolean; // 자동 제목 생성

  // Feature control settings
  "features.enableGraphSelection": boolean; // 그래프 선택 활성화 (비활성화 시 기본 그래프 사용)
  "features.enableConnectionSelection": boolean; // 커넥션 선택 활성화 (비활성화 시 기본 커넥션 사용)
  "features.enableAdvancedInput": boolean; // 고급 입력 활성화 (스키마 기반 선택적 필드)
  "features.defaultGraphId": string; // 기본 그래프 ID (그래프 선택 비활성화 시 사용)
  "features.defaultConnectionApiUrl": string; // 기본 커넥션 API URL (커넥션 선택 비활성화 시 사용)

  // Branding settings
  "branding.appTitle": string; // 앱 타이틀
  "branding.logoUrl": string; // 로고 이미지 URL
  "branding.faviconUrl": string; // Favicon URL (빈 값 = logoUrl 사용)
  "branding.chatOpeners": string[]; // 채팅 시작 문구 목록 (빈 배열 = 정적 설정 사용)
}

export type SettingKey = keyof GlobalSettings;

/**
 * Setting metadata for admin UI
 */
export interface SettingMeta {
  key: SettingKey;
  label: string;
  description: string;
  category: SettingCategory;
  type: "string" | "boolean" | "number" | "select" | "url" | "array";
  options?: string[];
  maxItems?: number; // array 타입일 때 최대 항목 수
  defaultValue: GlobalSettings[SettingKey];
}

/**
 * Database representation of a setting
 */
export interface GlobalSettingRecord {
  id: string;
  key: string;
  value: string; // JSON stringified
  category: string;
  updatedAt: Date;
  updatedById?: string | null;
}

/**
 * Default settings
 * These match the defaults in site.ts and environment variables
 */
export const DEFAULT_SETTINGS: GlobalSettings = {
  // Auth (matches env defaults)
  "auth.registrationPolicy": "open",
  "auth.allowRegistration": true,

  // UI (matches site.ts)
  "ui.welcomeMessage": "테디노트 챗봇에게 무엇이든 물어보세요.",
  "ui.chatInputPlaceholder": "궁금한 내용을 물어보세요.",

  // Features (matches site.ts)
  "features.enableFileUpload": true,
  "features.showHistory": true,
  "features.enableDeletion": true,
  "features.autoGenerateTitles": true,

  // Feature control
  "features.enableGraphSelection": true,
  "features.enableConnectionSelection": true,
  "features.enableAdvancedInput": true,
  "features.defaultGraphId": "",
  "features.defaultConnectionApiUrl": "",

  // Branding
  "branding.appTitle": "TeddyNote Chat",
  "branding.logoUrl": "/logo.png",
  "branding.faviconUrl": "", // 빈 값 = logoUrl 사용
  "branding.chatOpeners": [], // 빈 배열 = 정적 설정 사용
};

/**
 * Setting definitions with metadata for admin UI
 */
export const SETTING_DEFINITIONS: SettingMeta[] = [
  // Auth
  {
    key: "auth.allowRegistration",
    label: "회원가입 허용",
    description: "새로운 사용자의 회원가입을 허용합니다",
    category: "auth",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["auth.allowRegistration"],
  },
  {
    key: "auth.registrationPolicy",
    label: "회원가입 정책",
    description: "open: 즉시 승인, approval: 관리자 승인 필요",
    category: "auth",
    type: "select",
    options: ["open", "approval"],
    defaultValue: DEFAULT_SETTINGS["auth.registrationPolicy"],
  },

  // UI
  {
    key: "ui.welcomeMessage",
    label: "웰컴 메시지",
    description: "새 채팅 시작 시 표시되는 설명 메시지",
    category: "ui",
    type: "string",
    defaultValue: DEFAULT_SETTINGS["ui.welcomeMessage"],
  },
  {
    key: "ui.chatInputPlaceholder",
    label: "입력창 플레이스홀더",
    description: "채팅 입력창에 표시되는 안내 문구",
    category: "ui",
    type: "string",
    defaultValue: DEFAULT_SETTINGS["ui.chatInputPlaceholder"],
  },

  // Features
  {
    key: "features.enableFileUpload",
    label: "파일 업로드",
    description: "사용자가 파일을 업로드할 수 있도록 허용",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.enableFileUpload"],
  },
  {
    key: "features.showHistory",
    label: "채팅 히스토리",
    description: "사이드바에 이전 채팅 목록 표시",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.showHistory"],
  },
  {
    key: "features.enableDeletion",
    label: "스레드 삭제",
    description: "사용자가 채팅 스레드를 삭제할 수 있도록 허용",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.enableDeletion"],
  },
  {
    key: "features.autoGenerateTitles",
    label: "자동 제목 생성",
    description: "채팅 내용을 기반으로 자동으로 제목 생성",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.autoGenerateTitles"],
  },

  // Feature control
  {
    key: "features.enableGraphSelection",
    label: "그래프 선택 활성화",
    description: "사용자가 그래프(Assistant)를 선택할 수 있도록 허용. 비활성화 시 기본 그래프 사용",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.enableGraphSelection"],
  },
  {
    key: "features.enableConnectionSelection",
    label: "커넥션 선택 활성화",
    description: "사용자가 LangGraph 커넥션을 선택할 수 있도록 허용. 비활성화 시 기본 커넥션 사용",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.enableConnectionSelection"],
  },
  {
    key: "features.enableAdvancedInput",
    label: "고급 입력 활성화",
    description: "스키마 기반 선택적 필드 표시. 비활성화 시 기본 채팅 입력만 표시",
    category: "features",
    type: "boolean",
    defaultValue: DEFAULT_SETTINGS["features.enableAdvancedInput"],
  },
  {
    key: "features.defaultGraphId",
    label: "기본 그래프 ID",
    description: "그래프 선택 비활성화 시 사용할 기본 그래프 ID",
    category: "features",
    type: "string",
    defaultValue: DEFAULT_SETTINGS["features.defaultGraphId"],
  },
  {
    key: "features.defaultConnectionApiUrl",
    label: "기본 커넥션 API URL",
    description: "커넥션 선택 비활성화 시 사용할 기본 API URL",
    category: "features",
    type: "string",
    defaultValue: DEFAULT_SETTINGS["features.defaultConnectionApiUrl"],
  },

  // Branding
  {
    key: "branding.appTitle",
    label: "앱 타이틀",
    description: "브라우저 탭과 헤더에 표시되는 앱 이름",
    category: "branding",
    type: "string",
    defaultValue: DEFAULT_SETTINGS["branding.appTitle"],
  },
  {
    key: "branding.logoUrl",
    label: "로고 이미지 URL",
    description: "헤더와 로그인 페이지에 표시되는 로고 이미지 URL",
    category: "branding",
    type: "url",
    defaultValue: DEFAULT_SETTINGS["branding.logoUrl"],
  },
  {
    key: "branding.faviconUrl",
    label: "Favicon URL",
    description: "브라우저 탭에 표시되는 아이콘 URL (비워두면 로고 사용)",
    category: "branding",
    type: "url",
    defaultValue: DEFAULT_SETTINGS["branding.faviconUrl"],
  },
  {
    key: "branding.chatOpeners",
    label: "채팅 시작 문구",
    description: "새 채팅 시작 시 표시되는 예시 질문 목록 (비워두면 기본값 사용)",
    category: "branding",
    type: "array",
    maxItems: 20,
    defaultValue: DEFAULT_SETTINGS["branding.chatOpeners"],
  },
];
