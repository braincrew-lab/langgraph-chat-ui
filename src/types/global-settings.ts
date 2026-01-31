/**
 * Global settings types
 * Defines all configurable settings in the application
 * These settings can be modified by admins in the dashboard
 */

export type SettingCategory = "auth" | "ui" | "features";

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
  type: "string" | "boolean" | "number" | "select";
  options?: string[];
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
];
